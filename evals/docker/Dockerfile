# Runner image for `npm run eval -- --isolation container`. Each eval run starts one container from
# it per unit (case x target x repeat), plus one for the egress proxy (proxy.mjs).
#
# Built locally by the engine and tagged with a hash of this folder and the build args, so editing
# this file or upgrading the agent SDKs rebuilds it. Build args are filled in from the versions the
# installed SDKs expect (see src/sandbox/runner-image.ts).
FROM node:24-bookworm-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl git procps \
 && rm -rf /var/lib/apt/lists/*

ARG CLAUDE_CODE_VERSION
ARG CODEX_VERSION
RUN npm install -g "@anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}" "@openai/codex@${CODEX_VERSION}" \
 && npm cache clean --force

COPY proxy.mjs /opt/evals/proxy.mjs

# Folders that become volumes keep this ownership: the home volume per container, the npm cache
# volume shared across runs.
RUN mkdir -p /home/node/project /home/node/.npm /home/node/.claude \
 && chown -R node:node /home/node

USER node
WORKDIR /home/node/project
ENTRYPOINT ["sleep", "infinity"]
