# Audius Subgraph
This repository contains the code for the Audius Network Subgraph using [The Graph](https://thegraph.com/).  

The [staging playground](https://thegraph.com/explorer/subgraph/audius-infra/audius-network-ropsten) and [mainnet playground](https://thegraph.com/explorer/subgraph/audius-infra/audius-network-mainnet) of the subgraph can be explored through the graph's explorer tool.

## TODO
- [x] Set up a subgraph repo
- [x] Figure out local dev
- [x] Take a stab at writing the initial Data Models (Check out schema.graphql, except gov)
- [x] Get the team from the graph to review data models
- [x] Finish writing all the mapping from events (excluding gov.)
- [x] Write docs for the team on how to dev locally
- [ ] Write docs for the team on how The Graph works
- [ ] Add way more comments to the code
- [ ] Demo The Graph to the team - ideally on staging or could use the local setup and screenshare
- [x] Automate the tooling to generate the config (json file w/ addresses)
- [ ] Move the ABIs to be imported from the @audius/libs npm package (instead of manually moving to the abis folder)
- [x] Figure out the deploy process for staging
- [ ] Figure out the deploy process for prod
- [ ] Write a test suite 
- [ ] Automate tests w/ CI
- [ ] Add CD
- [ ] Figure out data models for Governance
- [ ] Write mappings for Governance

## Deploying the subgraph

There are two locations to deploy the subgraph:
- The graph team's hosted solution
- The graph main-net

### Hosted
```
npm run prepare:prod
npm run deploy:prod
```
You can then view the subgraph and watch it sync:
https://thegraph.com/explorer/subgraph/audius-infra/audius-network-mainnet

### Main-net
TODO

## Reference
Check out the docs from [The Graph](https://thegraph.com/docs/) for more information
