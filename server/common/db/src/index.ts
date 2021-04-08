// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// Export all auto generated files
export * from './auto/TableInterfaces';
export * from './auto/TableList';
export * from './auto/TableColumns';
export * from './auto/TableFilterColumns';

// Export the client and setup function
export { knex, setupDbConnection } from './client';

// Export table create/delete functions
export { createAllTables } from './auto/CreateFunctions';
export { dropAllTables } from './auto/DropFunctions';

// Export basic models
export * as BasicModel from './models/BasicModel';