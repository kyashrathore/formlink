---
title: "Pitfall — mock transport name"
description: "Incorrect import/export for mock transport factory."
---

# Pitfall — mock transport name

## Error

- The "@formlink/runtime" module does not provide an export named "mockTransportInDraft".

## Explanation

- The dev/mock transport factory is exported as `createMockTransport`.

## Fix

import { createMockTransport as mockTransportInDraft } from "@formlink/runtime"

## Usage

const rt = createRuntime({ form, transport: mockTransportInDraft() })
