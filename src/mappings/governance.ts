import { BigInt } from '@graphprotocol/graph-ts'
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
  MaxInProgressProposalsUpdated,
  Governance
} from '../types/Governance/Governance'
import {
  AudiusNetwork,
  Proposal,
  Vote,
  ProposalSubmittedEvent,
  ProposalVoteSubmittedEvent,
  ProposalVoteUpdatedEvent,
  ProposalOutcomeEvaluatedEvent,
  ProposalTransactionExecutedEvent,
  GuardianTransactionExecutedEvent,
  ProposalVetoedEvent
} from '../types/schema'
import { 
  createOrLoadUser,
  getVoteId,
  getProposalOutcome,
  getVoteType,
} from './helpers'

export function handleProposalSubmitted(event: ProposalSubmitted): void {
  let governanceContract = Governance.bind(event.address)
  let contractProposal = governanceContract.getProposalById(event.params._proposalId)
  let proposal = new Proposal(event.params._proposalId.toString())
  let proposer = createOrLoadUser(event.params._proposer, event.block.timestamp)
  proposal.proposer = proposer.id
  proposal.name = event.params._name
  proposal.description = event.params._description
  proposal.submissionBlockNumber = contractProposal.value2
  proposal.targetContractRegistryKey = contractProposal.value3
  proposal.targetContractAddress = contractProposal.value4
  proposal.callValue = contractProposal.value5
  proposal.functionSignature = contractProposal.value6
  proposal.callData = contractProposal.value7
  proposal.outcome = getProposalOutcome(contractProposal.value8)
  proposal.voteMagnitudeYes = contractProposal.value9
  proposal.voteMagnitudeNo = contractProposal.value10
  proposal.numVotes = contractProposal.value11
  proposal.save()

  let proposalSubmittedEvent = new ProposalSubmittedEvent(proposal.id)
  proposalSubmittedEvent.proposal = proposal.id
  proposalSubmittedEvent.proposer = proposer.id
  proposalSubmittedEvent.name = event.params._name
  proposalSubmittedEvent.description = event.params._description
  proposalSubmittedEvent.save()
}

export function handleProposalVoteSubmitted(event: ProposalVoteSubmitted): void {
  let proposalId = event.params._proposalId.toString()
  let proposal = Proposal.load(proposalId)
  if (proposal === null) return

  let user = createOrLoadUser(event.params._voter, event.block.timestamp)
  let voteId = getVoteId(proposalId, user.id)
  let vote = new Vote(voteId)
  let voteType = getVoteType(event.params._vote)
  vote.proposal = proposalId
  vote.voter = user.id
  vote.vote = voteType
  vote.magnitude = event.params._voterStake
  vote.createdBlockNumber = event.block.number
  vote.updatedBlockNumber = event.block.number
  vote.save()

  if (voteType == 'Yes') {
    proposal.numVotes = proposal.numVotes.plus(BigInt.fromI32(1))
    proposal.voteMagnitudeYes = proposal.voteMagnitudeYes.plus(event.params._voterStake)
  } else if (voteType == 'No') {
    proposal.numVotes = proposal.numVotes.plus(BigInt.fromI32(1))
    proposal.voteMagnitudeNo = proposal.voteMagnitudeNo.plus(event.params._voterStake)
  }
  proposal.save()

  let eventId = event.transaction.from.toHex()
  let proposalVoteSubmittedEvent = new ProposalVoteSubmittedEvent(eventId)
  proposalVoteSubmittedEvent.proposal = proposalId
  proposalVoteSubmittedEvent.voter = user.id
  proposalVoteSubmittedEvent.vote = vote.id
  proposalVoteSubmittedEvent.currentVote = voteType === 'Yes' ? voteType : 'No'
  proposalVoteSubmittedEvent.voterStake = event.params._voterStake 
  proposalVoteSubmittedEvent.blockNumber = event.block.number
  proposalVoteSubmittedEvent.save()
}

export function handleProposalVoteUpdated(event: ProposalVoteUpdated): void {
  let proposalId = event.params._proposalId.toString()
  let proposal = Proposal.load(proposalId)
  let user = createOrLoadUser(event.params._voter, event.block.timestamp)
  let voteId = getVoteId(proposalId, user.id)
  let vote = Vote.load(voteId)
  // if vote doesn't exist nothing we can index
  if (vote === null) return
  let voteType = getVoteType(event.params._vote)
  vote.vote = voteType
  vote.updatedBlockNumber = event.block.number
  let prevVoteType = getVoteType(event.params._previousVote)
  if (proposal !== null) {
    if (prevVoteType == 'Yes') {
      proposal.voteMagnitudeYes = proposal.voteMagnitudeYes.minus(vote.magnitude)
    } else if (prevVoteType == 'No') {
      proposal.voteMagnitudeNo = proposal.voteMagnitudeNo.minus(vote.magnitude)
    }
  
    if (voteType == 'Yes') {
      proposal.voteMagnitudeYes = proposal.voteMagnitudeYes.plus(event.params._voterStake)
    } else if (voteType == 'No') {
      proposal.voteMagnitudeNo = proposal.voteMagnitudeNo.plus(event.params._voterStake)
    }
  
    proposal.save()
  }

  vote.magnitude = event.params._voterStake
  vote.save()

  let eventId = event.transaction.from.toHex()
  let proposalVoteUpdatedEvent = new ProposalVoteUpdatedEvent(eventId)
  proposalVoteUpdatedEvent.proposal = proposalId
  proposalVoteUpdatedEvent.voter = user.id
  proposalVoteUpdatedEvent.vote = vote.id
  proposalVoteUpdatedEvent.voterStake = event.params._voterStake 
  if (proposalVoteUpdatedEvent !== null) {
    if (voteType !== null) {
      proposalVoteUpdatedEvent.currentVote = voteType
    }
    if (prevVoteType !== null) {
      proposalVoteUpdatedEvent.previousVote = prevVoteType
    }
  }
  proposalVoteUpdatedEvent.blockNumber = event.block.number
  proposalVoteUpdatedEvent.save()

}

export function handleProposalOutcomeEvaluated(event: ProposalOutcomeEvaluated): void {
  let proposalId = event.params._proposalId.toString()
  let proposal = Proposal.load(proposalId)
  if (proposal === null) return
  proposal.outcome = getProposalOutcome(event.params._outcome)

  // TODO: Update proposal
  let eventId = event.transaction.from.toHex()
  let proposalOutcomeEvaluatedEvent = new ProposalOutcomeEvaluatedEvent(eventId)
  proposalOutcomeEvaluatedEvent.proposal = proposal.id
  proposalOutcomeEvaluatedEvent.outcome = proposal.outcome
  proposalOutcomeEvaluatedEvent.voteMagnitudeYes = event.params._voteMagnitudeYes
  proposalOutcomeEvaluatedEvent.voteMagnitudeNo = event.params._voteMagnitudeNo
  proposalOutcomeEvaluatedEvent.numVotes = event.params._numVotes
  proposalOutcomeEvaluatedEvent.blockNumber = event.block.number
  proposalOutcomeEvaluatedEvent.save()
}

export function handleProposalTransactionExecuted(event: ProposalTransactionExecuted): void {
  let proposalId = event.params._proposalId.toString()
  let proposal = Proposal.load(proposalId)
  // TODO: Update proposal


  let eventId = event.transaction.from.toHex()
  let proposalTransactionExecutedEvent = new ProposalTransactionExecutedEvent(eventId)
  if (proposal !== null) {
    proposalTransactionExecutedEvent.proposal = proposal.id
  }
  proposalTransactionExecutedEvent.success = event.params._success
  proposalTransactionExecutedEvent.returnData = event.params._returnData
  proposalTransactionExecutedEvent.blockNumber = event.block.number
  proposalTransactionExecutedEvent.save()
}

export function handleProposalVetoed(event: ProposalVetoed): void {
  let proposalId = event.params._proposalId.toString()
  let proposal = Proposal.load(proposalId)
  // TODO: Update proposal


  let eventId = event.transaction.from.toHex()
  let proposalVetoedEvent = new ProposalVetoedEvent(eventId)
  if (proposal !== null) {
    proposalVetoedEvent.proposal = proposal.id
  }
  proposalVetoedEvent.blockNumber = event.block.number
  proposalVetoedEvent.save()
}

export function handleGuardianTransactionExecuted(event: GuardianTransactionExecuted): void {
  let eventId = event.transaction.from.toHex()
  let guardianTransactionExecutedEvent = new GuardianTransactionExecutedEvent(eventId)
  guardianTransactionExecutedEvent.targetContractAddress = event.params._targetContractAddress
  guardianTransactionExecutedEvent.callValue = event.params._callValue
  guardianTransactionExecutedEvent.functionSignature = event.params._functionSignature.toString()
  guardianTransactionExecutedEvent.callData = event.params._callData
  guardianTransactionExecutedEvent.returnData = event.params._returnData
  guardianTransactionExecutedEvent.blockNumber = event.block.number
  guardianTransactionExecutedEvent.save()
}

export function handleRegistryAddressUpdated(event: RegistryAddressUpdated): void {
  // TODO: Figure this out!
  return
}

export function handleGuardianshipTransferred(event: GuardianshipTransferred): void {
  let audiusNetwork = AudiusNetwork.load('1')
  if (audiusNetwork === null) return
  audiusNetwork.guardianAddress = event.params._newGuardianAddress
  audiusNetwork.save()
}
export function handleVotingPeriodUpdated(event: VotingPeriodUpdated): void {
  let audiusNetwork = AudiusNetwork.load('1')
  if (audiusNetwork === null) return
  audiusNetwork.votingPeriod = event.params._newVotingPeriod
  audiusNetwork.save()
}
export function handleExecutionDelayUpdated(event: ExecutionDelayUpdated): void {
  let audiusNetwork = AudiusNetwork.load('1')
  if (audiusNetwork === null) return
  audiusNetwork.executionDelay = event.params._newExecutionDelay
  audiusNetwork.save()
}
export function handleVotingQuorumPercentUpdated(event: VotingQuorumPercentUpdated): void {
  let audiusNetwork = AudiusNetwork.load('1')
  if (audiusNetwork === null) return
  audiusNetwork.votingQuorumPercent = event.params._newVotingQuorumPercent
  audiusNetwork.save()
}
export function handleMaxInProgressProposalsUpdated(event: MaxInProgressProposalsUpdated): void {
  // TODO: cast uint256 as uint16
  // let audiusNetwork = AudiusNetwork.load('1')
  // audiusNetwork.maxInProgressProposals = event.params._newMaxInProgressProposals as 
  // audiusNetwork.save()
}
