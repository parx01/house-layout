# A3.1 persistent semantic spaces

A3.1 introduced stable semantic identities that can be bound to A2.4-derived faces. At that checkpoint it deliberately did not map the Option-3 rooms; A3.2 now supplies the separate curated baseline mapping.

## Model boundary

The current active semantic model has `status: "active"`, `modelVersion: 2`, and a list of spaces. Each space contains only:

- a persistent `SpaceId` using the `s-...` namespace;
- a non-empty display name;
- one category: `room`, `circulation`, `service`, `storage`, or `other`;
- its current derived `FaceId` binding.
- explicit `architecturalRole` and physical `enclosure` values.

`SpaceId` is intentionally distinct from `FaceId`. Face IDs describe the current topology-derived cycle and may change after later topology edits. Space IDs are persistent semantic identity. No polygon, vertex list, area, courtyard meaning, coverage role, opening, or display geometry is stored in the semantic model.

## Validation

Validation is strict and rejects:

- malformed or duplicate space IDs;
- unknown categories or fields;
- duplicate face bindings;
- malformed face IDs;
- face references absent from the current A2.4 extraction;
- active spaces when topology is deferred.

Legacy rectangles are compatibility/reference data and no longer invalidate canonical topology or spaces. A canonical topology update preserves or safely rebinds semantic identity only when correspondence is unambiguous; otherwise it returns `remapRequired` atomically. The A3-complete gate additionally requires every bounded face to be claimed and every role/enclosure to be classified.

## ProjectV2 migration

ProjectV2 schema revision 4 introduced the active spaces slot. Revision 3 is not broadened: its spaces field must still be the historical deferred envelope. A2.6.1 revision 5 then makes canonical topology independent of legacy rectangles. A3.5 revision 6 adds role/enclosure fields. Revision-4/5 active spaces migrate without changing stable bindings and use explicit `unclassified` values rather than guessed meaning. Revision-2 and original A1 files continue through explicit migration with spaces deferred.
