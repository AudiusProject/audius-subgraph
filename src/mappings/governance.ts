import {
  ProposalSubmitted,
  ProposalVoteSubmitted,
  ProposalVoteUpdated,
  ProposalOutcomeEvaluated,
  ProposalTransactionExecuted,
  GuardianTransactionExecuted,
  ProposalVetoed,
  RegistryAddressUpdated,
  GuardianshipTransferred,
  VotingPeriodUpdated,
  ExecutionDelayUpdated,
  VotingQuorumPercentUpdated,
  MaxInProgressProposalsUpdated
} from '../types/Governance/Governance'
import {
  AudiusNetwork
} from '../types/schema'

export function handleProposalSubmitted(event: ProposalSubmitted): void {
  // TODO: Figure this out!
  return
}
export function handleProposalVoteSubmitted(event: ProposalVoteSubmitted): void {
  // TODO: Figure this out!
  return
}
export function handleProposalVoteUpdated(event: ProposalVoteUpdated): void {
  // TODO: Figure this out!
  return
}
export function handleProposalOutcomeEvaluated(event: ProposalOutcomeEvaluated): void {
  // TODO: Figure this out!
  return
}
export function handleProposalTransactionExecuted(event: ProposalTransactionExecuted): void {
  // TODO: Figure this out!
  return
}
export function handleGuardianTransactionExecuted(event: GuardianTransactionExecuted): void {
  // TODO: Figure this out!
  return
}
export function handleProposalVetoed(event: ProposalVetoed): void {
  // TODO: Figure this out!
  return
}
export function handleRegistryAddressUpdated(event: RegistryAddressUpdated): void {
  // TODO: Figure this out!
  return
}

export function handleGuardianshipTransferred(event: GuardianshipTransferred): void {
  let audiusNetwork = AudiusNetwork.load('1')
  audiusNetwork.guardianAddress = event.params._newGuardianAddress
  audiusNetwork.save()
}
export function handleVotingPeriodUpdated(event: VotingPeriodUpdated): void {
  let audiusNetwork = AudiusNetwork.load('1')
  audiusNetwork.votingPeriod = event.params._newVotingPeriod
  audiusNetwork.save()
}
export function handleExecutionDelayUpdated(event: ExecutionDelayUpdated): void {
  let audiusNetwork = AudiusNetwork.load('1')
  audiusNetwork.executionDelay = event.params._newExecutionDelay
  audiusNetwork.save()
}
export function handleVotingQuorumPercentUpdated(event: VotingQuorumPercentUpdated): void {
  let audiusNetwork = AudiusNetwork.load('1')
  audiusNetwork.votingQuorumPercent = event.params._newVotingQuorumPercent
  audiusNetwork.save()
}
export function handleMaxInProgressProposalsUpdated(event: MaxInProgressProposalsUpdated): void {
  // TODO: cast uint256 as uint16
  // let audiusNetwork = AudiusNetwork.load('1')
  // audiusNetwork.maxInProgressProposals = event.params._newMaxInProgressProposals as 
  // audiusNetwork.save()
}
