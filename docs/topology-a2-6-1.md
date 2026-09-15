# A2.6.1 canonical authority transition

A2.6.1 completes the authority transition begun by topology-native rendering. Active canonical topology no longer has to equal the original curated Option-3 graph or agree with legacy room rectangles. `legacyEditorState` remains preserved as compatibility/reference data and is not architectural authority.

## Protections retained

Every current project still requires:

- strict canonical topology validation;
- node centre-lines inside the authoritative site boundary;
- complete wall-thickness bands inside that boundary;
- `building.status` consistent with topology status;
- valid semantic-space bindings against currently derived faces;
- explicit migration from original A1 and ProjectV2 revisions 2, 3, and 4.

Raw V1 recovery remains conservative. Only the known Option-3 baseline receives the curated topology automatically; edited or arbitrary V1 input stays topology-deferred.

## Project-level movement transaction

`applyTopologyMoveResult()` is the canonical path for accepting an A2.5 movement result. It validates the input project and candidate topology, requires stable node/wall identity and wall connectivity/thickness, checks movement metadata against the actual node changes, and verifies the before/after derived face identities.

The transaction does not rewrite `legacyEditorState`. A successful result becomes the active project topology and can be validated, serialized, reloaded, and rendered normally.

Active semantic spaces are preserved when every bound `FaceId` survives. If a bound face disappears, the transaction rejects explicitly; it never guesses a remapping. Site-containment failures and incomplete movement metadata also reject atomically.

## Schema revision

ProjectV2 revision 5 records the relaxed authority rule instead of silently broadening revision 4. Revision-4 A3.1 files migrate explicitly, including active semantic spaces and stable `SpaceId` bindings.

The curated Option-3 topology fixture is unchanged. No semantic Option-3 room mapping or geometry-editing UI is introduced here.
