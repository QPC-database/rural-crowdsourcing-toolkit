// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

package com.microsoft.research.karya.data.model.karya.modelsExtra

import com.microsoft.research.karya.data.model.karya.ng.AuthType

data class WorkerObject(
  var creation_code: String,
  var auth_: AuthType,
  var phone_number: String,
  var age: String,
  var gender: String,
  var app_language: Int? = null,
)
