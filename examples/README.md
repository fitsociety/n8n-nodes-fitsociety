# Synthetic workflows

Import into a disposable instance, select your own approved company credential on each FITsociety node and save. Both examples are inactive and contain no real client IDs, credential references or secrets. The lookup example performs reads only. The event example receives signed client events and reads the referenced client; confirm the incoming data.clientId in the trigger output for your event before enabling downstream steps. Give copied trigger nodes their own generated webhook ID before activation so independent workflows cannot share a signing key/callback accidentally.

Published/community installations use node types n8n-nodes-fitsociety.fitsociety and n8n-nodes-fitsociety.fitsocietyTrigger. CLI custom-extension development may expose CUSTOM.fitsociety and CUSTOM.fitsocietyTrigger; select the corresponding locally loaded node type for that development mode. Test with the actual packaged community-node loader before rollout.

For write workflows, map the source event ID to Business Event Key. Do not use a constant value for different business events. Duplicate deliveries are possible; use an atomic external deduplication store for exactly-once business requirements.
