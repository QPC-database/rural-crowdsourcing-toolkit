// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

/**
 * Model functions to handle queries from a box
 */

import { BoxRecord, DbRecordType, DbTableName, BasicModel } from '@karya/common';

import { Promise as BBPromise } from 'bluebird';
import { getBlobSASURL } from '@karya/common';

const boxUpdatableTables = [
  'worker',
  'karya_file',
  'task_assignment',
  'microtask_group_assignment',
  'microtask_assignment',
] as const;
type BoxUpdatableTable = typeof boxUpdatableTables[number];

// Type for collecting table updates
export type TableUpdates<TableName extends DbTableName> = {
  tableName: TableName;
  rows: DbRecordType<TableName>[];
};

/**
 * Collect all updates for a specific box
 * @param box Record corresponding to the box
 */
export async function getUpdatesForBox(box: BoxRecord, from: string): Promise<TableUpdates<DbTableName>[]> {
  const box_id = box.id;

  const updates: TableUpdates<DbTableName>[] = [];

  const updateMap: { [key in DbTableName]?: DbRecordType<key>[] } = {};

  // Get task assignment updates
  const task_assignment_updates = await BasicModel.getRecords('task_assignment', { box_id, status: 'assigned' });

  updateMap['task_assignment'] = await BasicModel.getRecords('task_assignment', { box_id }, { from });

  // Get all tasks corresponding to the task assignments
  const task_ids = task_assignment_updates.map((t) => t.task_id);
  const task_updates = await BasicModel.getRecords('task', {}, { from }, {}, [['id', task_ids]]);
  updateMap['task'] = task_updates;

  // Get all microtask groups corresponding to the tasks
  const microtask_group_updates = await BasicModel.getRecords('microtask_group', {}, { from }, {}, [
    ['task_id', task_ids],
  ]);
  updateMap['microtask_group'] = microtask_group_updates;

  // Get all microtask corresponding to the tasks
  const microtask_updates = await BasicModel.getRecords('microtask', {}, { from }, {}, [['task_id', task_ids]]);
  updateMap['microtask'] = microtask_updates;

  const microtask_file_ids = microtask_updates.map((m) => m.input_file_id);

  let karya_file_ids: string[] = [];
  [microtask_file_ids].forEach((idlist) => {
    karya_file_ids = karya_file_ids.concat(idlist.filter((id): id is string => id !== null));
  });
  const karya_file_updates = (await BasicModel.getRecords('karya_file', {}, {}, {}, [['id', karya_file_ids]]))
    //@ts-ignore
    .filter((kf) => kf.last_updated_at.toISOString() > from);

  // Update all the karya_files with sas tokens
  karya_file_updates.forEach((kf) => {
    kf.url = kf.url !== null ? getBlobSASURL(kf.url, 'r', 60) : null;
  });
  updateMap['karya_file'] = (updateMap['karya_file'] || []).concat(karya_file_updates);

  // Collect verified microtask assigmnents
  updateMap['microtask_assignment'] = await BasicModel.getRecords(
    'microtask_assignment',
    { box_id, status: 'verified' },
    { from }
  );

  // Push all updates
  [
    'box',
    'worker',
    'karya_file',
    'task',
    'microtask_group',
    'microtask',
    'task_assignment',
    'microtask_group_assignment',
    'microtask_assignment',
  ].forEach((t) => {
    const tupdates = updateMap[t as DbTableName];
    if (tupdates && tupdates.length > 0) {
      updates.push({ tableName: t as DbTableName, rows: tupdates });
    }
  });

  return updates;
}

/**
 * Apply updates to different tables from the box. For microtask assignment
 * records, call completion handler if assignments are completed.
 * @param box Record for the box
 * @param updates Updates to different tables from the box
 */
export async function applyUpdatesFromBox(box: BoxRecord, updates: TableUpdates<BoxUpdatableTable>[]) {
  await BBPromise.mapSeries(updates, async (update) => {
    const { tableName, rows } = update;
    if (!boxUpdatableTables.includes(tableName)) {
      throw new Error(`Box cannot update table '${tableName}'`);
    }

    await BBPromise.mapSeries(rows, async (row) => {
      if (row.box_id !== box.id) {
        throw new Error(`Box can only update its own record`);
      }
      if (tableName === 'microtask_assignment') {
        /**
         * Below code is to handle microtask assignment completion as the
         * server. In the new format, our plan is to deal with this using task
         * chains. Commenting it out for now.
         */
        // let currentMta: MicrotaskAssignmentRecord | null = null;
        // try {
        //   currentMta = await BasicModel.getSingle('microtask_assignment', {
        //     id: row.id,
        //   });
        // } catch (e) {
        //   // record does not exist
        // }

        // @ts-ignore
        await BasicModel.upsertRecord(tableName, row);

        /**
         * Below code is to handle microtask assignment completion as the
         * server. In the new format, our plan is to deal with this using task
         * chains. Commenting it out for now.
         */
        // const mta = row as MicrotaskAssignmentRecord;
        // if ((!currentMta || currentMta.status === 'assigned') && mta.status === 'completed') {
        //   const mt = await BasicModel.getSingle('microtask', {
        //     id: mta.microtask_id,
        //   });
        //   const task = await BasicModel.getSingle('task', { id: mt.task_id });
        //   await scenarioById[Number.parseInt(task.scenario_id, 10)].handleMicrotaskAssignmentCompletion(mta, mt, task);
        // }
      } else {
        // @ts-ignore
        await BasicModel.upsertRecord(tableName, row);
      }
    });
  });
}
