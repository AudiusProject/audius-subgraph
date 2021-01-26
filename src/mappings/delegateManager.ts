import { BigInt } from '@graphprotocol/graph-ts'
import {
  IncreaseDelegatedStake,
  UndelegateStakeRequested,
  UndelegateStakeRequestCancelled,
  UndelegateStakeRequestEvaluated,
  Claim,
  Slash,
  RemoveDelegatorRequested,
  RemoveDelegatorRequestCancelled,
  RemoveDelegatorRequestEvaluated,
  MaxDelegatorsUpdated,
  MinDelegationUpdated,
  UndelegateLockupDurationUpdated,
  GovernanceAddressUpdated,
  StakingAddressUpdated,
  ServiceProviderFactoryAddressUpdated,
  ClaimsManagerAddressUpdated,
  RemoveDelegatorLockupDurationUpdated,
  RemoveDelegatorEvalDurationUpdated,
  DelegateManager
} from '../types/DelegateManager/DelegateManager'
import { Staking } from '../types/Staking/Staking'
import {
  AudiusNetwork,
  ServiceNode,
  RegisteredServiceProviderEvent,
  DeregisteredServiceProviderEvent,
  IncreasedStakeEvent,
  UpdateDeployerCutEvent,
  RemoveDelegatorEvent,
  UndelegateStakeEvent,
  IncreaseDelegatedStakeEvent,
  ClaimEvent
} from '../types/schema'
import { 
  getServiceId, 
  createOrLoadUser,
  createOrLoadDelegate,
  getRequestCountId
} from './helpers'


export function handleClaim(event: Claim): void {
  let id = event.transaction.from.toHex()
  let claimer = createOrLoadUser(event.params._claimer, event.block.timestamp)
  let claimEvent = new ClaimEvent(id)
  claimEvent.rewards = event.params._rewards
  claimEvent.blockNumber = event.block.number
  claimEvent.claimer = claimer.id
  claimEvent.save()

  // Query all delegators of the claimer and for each, fetch their delegation amount
  let delegateManagerContract = DelegateManager.bind(event.address)
  let stakingAddress = delegateManagerContract.getStakingAddress()
  let stakingContract = Staking.bind(stakingAddress)

  let totalClaimerDelegated = delegateManagerContract.getTotalDelegatedToServiceProvider(event.params._claimer)
  let totalClaimedDelegatedLocked = delegateManagerContract.getTotalLockedDelegationForServiceProvider(event.params._claimer)
  let stakeAmount = stakingContract.totalStakedFor(event.params._claimer)
  claimer.delegationReceivedAmount = totalClaimerDelegated
  claimer.claimableDelegationReceivedAmount = totalClaimerDelegated.minus(totalClaimedDelegatedLocked)
  // claimer.claimableStakeAmount = stakeAmount.minus(claimer.stakeAmount.minus(claimer.claimableStakeAmount))
  claimer.stakeAmount = stakeAmount
  // claimer.totalClaimableAmount = claimer.claimableDelegationReceivedAmount.plus(claimer.claimableStakeAmount)
  claimer.save()

  // Handle all the delegators
  let delegators = delegateManagerContract.getDelegatorsList(event.params._claimer)
  for (let i = 0; i < delegators.length; ++i) {
    let delegatorAddress = delegators[i]
    let delegateAmount = delegateManagerContract.getDelegatorStakeForServiceProvider(delegatorAddress, event.params._claimer)
    let delegate = createOrLoadDelegate(event.params._claimer, delegatorAddress)
    let claimableDiff = delegate.amount.minus(delegate.claimableAmount)
    let delegationDiff = delegateAmount.minus(delegate.amount)
    delegate.claimableAmount = delegateAmount.minus(claimableDiff)
    delegate.amount = delegateAmount
    delegate.save()
    if (delegationDiff.gt(BigInt.fromI32(0))) {
      let delegator = createOrLoadUser(delegatorAddress, event.block.timestamp)
      delegator.claimableDelegationSentAmount = delegator.claimableDelegationSentAmount.plus(delegationDiff)
      delegator.delegationSentAmount = delegator.delegationSentAmount.plus(delegationDiff)
      delegator.totalClaimableAmount = delegator.totalClaimableAmount.plus(delegationDiff)
      delegator.save()
    }
  }
}

export function handleSlash(event: Slash): void {
  return
}

export function handleIncreaseDelegatedStake(event: IncreaseDelegatedStake): void {
  // Update serviceProvider props
  let serviceProvider = createOrLoadUser(event.params._serviceProvider, event.block.timestamp)
  serviceProvider.claimableDelegationReceivedAmount = serviceProvider.claimableDelegationReceivedAmount.plus(event.params._increaseAmount)
  serviceProvider.totalClaimableAmount = serviceProvider.totalClaimableAmount.plus(event.params._increaseAmount)
  serviceProvider.delegationReceivedAmount = serviceProvider.delegationReceivedAmount.plus(event.params._increaseAmount)
  serviceProvider.stakeAmount = serviceProvider.stakeAmount.plus(event.params._increaseAmount)
  serviceProvider.save()

  // Update delegators props
  let delegator = createOrLoadUser(event.params._delegator, event.block.timestamp)
  delegator.claimableDelegationSentAmount = delegator.claimableDelegationSentAmount.plus(event.params._increaseAmount)
  // delegator.claimableStakeAmount = delegator.claimableStakeAmount.plus(event.params._increaseAmount)
  delegator.delegationSentAmount = delegator.delegationSentAmount.plus(event.params._increaseAmount)
  delegator.totalClaimableAmount = delegator.totalClaimableAmount.plus(event.params._increaseAmount)
  delegator.save()

  // Update delegate props
  let delegate = createOrLoadDelegate(event.params._serviceProvider, event.params._delegator)
  delegate.amount = delegate.amount.plus(event.params._increaseAmount)
  delegate.claimableAmount = delegate.amount.plus(event.params._increaseAmount)
  delegate.save()

  // Create event
  let eventId = event.transaction.from.toHex()
  let increaseDelegatedStakeEvent = new IncreaseDelegatedStakeEvent(eventId)
  increaseDelegatedStakeEvent.delegator = delegator.id
  increaseDelegatedStakeEvent.serviceProvider = serviceProvider.id
  increaseDelegatedStakeEvent.blockNumber = event.block.number
  increaseDelegatedStakeEvent.increaseAmount = event.params._increaseAmount
  increaseDelegatedStakeEvent.save()
}

export function handleUndelegateStakeRequested(event: UndelegateStakeRequested): void {
  let serviceProvider = createOrLoadUser(event.params._serviceProvider, event.block.timestamp)
  let delegator = createOrLoadUser(event.params._delegator, event.block.timestamp)

  let id = getRequestCountId()
  let undelegateStakeEvent = new UndelegateStakeEvent(id)
  undelegateStakeEvent.status = 'Requested'
  undelegateStakeEvent.owner = delegator.id
  undelegateStakeEvent.serviceProvider = serviceProvider.id
  undelegateStakeEvent.amount = event.params._amount
  undelegateStakeEvent.expiryBlock = event.params._lockupExpiryBlock
  undelegateStakeEvent.createdBlockNumber = event.block.number
  undelegateStakeEvent.save()

  delegator.totalClaimableAmount = delegator.totalClaimableAmount.minus(event.params._amount)
  delegator.claimableDelegationSentAmount = delegator.claimableDelegationSentAmount.minus(event.params._amount)
  delegator.pendingUndelegateStake = undelegateStakeEvent.id
  delegator.save()

  serviceProvider.claimableDelegationReceivedAmount = serviceProvider.claimableDelegationReceivedAmount.minus(event.params._amount)
  serviceProvider.save()

  let delegate = createOrLoadDelegate(event.params._serviceProvider, event.params._delegator)
  delegate.claimableAmount = delegate.claimableAmount.minus(event.params._amount)
  delegate.save()
}

export function handleUndelegateStakeRequestCancelled(event: UndelegateStakeRequestCancelled): void {
  let delegator = createOrLoadUser(event.params._delegator, event.block.timestamp)
  let serviceProvider = createOrLoadUser(event.params._serviceProvider, event.block.timestamp)
  let undelegateStakeId = delegator.pendingUndelegateStake
  if (undelegateStakeId === null) {
    return
  }
  let undelegateStakeEvent = UndelegateStakeEvent.load(undelegateStakeId)
  undelegateStakeEvent.status = 'Cancelled'
  undelegateStakeEvent.endedBlockNumber = event.block.number
  undelegateStakeEvent.save()

  delegator.totalClaimableAmount = delegator.totalClaimableAmount.plus(event.params._amount)
  delegator.claimableDelegationSentAmount = delegator.claimableDelegationSentAmount.plus(event.params._amount)
  delegator.pendingUndelegateStake = null
  delegator.save()

  serviceProvider.claimableDelegationReceivedAmount = serviceProvider.claimableDelegationReceivedAmount.plus(event.params._amount)
  serviceProvider.save()

  let delegate = createOrLoadDelegate(event.params._serviceProvider, event.params._delegator)
  delegate.claimableAmount = delegate.claimableAmount.plus(event.params._amount)
  delegate.save()
}

export function handleUndelegateStakeRequestEvaluated(event: UndelegateStakeRequestEvaluated): void {
  let delegator = createOrLoadUser(event.params._delegator, event.block.timestamp)
  let serviceProvider = createOrLoadUser(event.params._serviceProvider, event.block.timestamp)
  let undelegateStakeId = delegator.pendingUndelegateStake
  if (undelegateStakeId === null) {
    return
  }
  let undelegateStakeEvent = UndelegateStakeEvent.load(undelegateStakeId)
  undelegateStakeEvent.status = 'Evaluated'
  undelegateStakeEvent.endedBlockNumber = event.block.number
  undelegateStakeEvent.save()

  event.params._amount
  delegator.totalClaimableAmount = delegator.totalClaimableAmount.plus(event.params._amount)
  delegator.claimableDelegationSentAmount = delegator.claimableDelegationSentAmount.plus(event.params._amount)
  delegator.pendingUndelegateStake = null
  delegator.save()

  serviceProvider.totalClaimableAmount = serviceProvider.totalClaimableAmount.plus(event.params._amount)
  serviceProvider.claimableDelegationReceivedAmount = serviceProvider.claimableDelegationReceivedAmount.plus(event.params._amount)
  serviceProvider.save()

  let delegate = createOrLoadDelegate(event.params._serviceProvider, event.params._delegator)
  delegate.amount = delegate.amount.plus(event.params._amount)
  delegate.save()
}

export function handleRemoveDelegatorRequested(event: RemoveDelegatorRequested): void {
  let serviceProvider = createOrLoadUser(event.params._serviceProvider, event.block.timestamp)
  let delegator = createOrLoadUser(event.params._delegator, event.block.timestamp)

  let id = getRequestCountId()
  let updateDeployerCutEvent = new RemoveDelegatorEvent(id)
  updateDeployerCutEvent.status = 'Requested'
  updateDeployerCutEvent.owner = serviceProvider.id
  updateDeployerCutEvent.delegator = delegator.id
  updateDeployerCutEvent.expiryBlock = event.params._lockupExpiryBlock
  updateDeployerCutEvent.createdBlockNumber = event.block.number
  updateDeployerCutEvent.save()

  serviceProvider.pendingRemoveDelegator = updateDeployerCutEvent.id
  serviceProvider.save()
}

export function handleRemoveDelegatorRequestCancelled(event: RemoveDelegatorRequestCancelled): void {
  let serviceProvider = createOrLoadUser(event.params._serviceProvider, event.block.timestamp)
  let removeDelegatorEventId = serviceProvider.pendingRemoveDelegator
  if (removeDelegatorEventId === null) {
    return
  }
  let removeDelegatorEvent = RemoveDelegatorEvent.load(removeDelegatorEventId)
  removeDelegatorEvent.status = 'Cancelled'
  removeDelegatorEvent.endedBlockNumber = event.block.number
  removeDelegatorEvent.save()

  serviceProvider.pendingRemoveDelegator = null
  serviceProvider.save()
}

export function handleRemoveDelegatorRequestEvaluated(event: RemoveDelegatorRequestEvaluated): void {
  let serviceProvider = createOrLoadUser(event.params._serviceProvider, event.block.timestamp)
  let removeDelegatorEventId = serviceProvider.pendingRemoveDelegator
  if (removeDelegatorEventId === null) {
    return
  }
  let updateDeployerCutEvent = UpdateDeployerCutEvent.load(removeDelegatorEventId)
  updateDeployerCutEvent.status = 'Evaluated'
  updateDeployerCutEvent.endedBlockNumber = event.block.number
  updateDeployerCutEvent.save()

  serviceProvider.pendingRemoveDelegator = null
  serviceProvider.save()


  let delegate = createOrLoadDelegate(event.params._serviceProvider, event.params._delegator)
  delegate.amount = BigInt.fromI32(0)
  delegate.save()
}

export function handleMaxDelegatorsUpdated(event: MaxDelegatorsUpdated): void {
  let audiusNetwork = AudiusNetwork.load('1')
  audiusNetwork.maxDelegators = event.params._maxDelegators
  audiusNetwork.save()

}

export function handleMinDelegationUpdated(event: MinDelegationUpdated): void {
  let audiusNetwork = AudiusNetwork.load('1')
  audiusNetwork.minDelegationAmount = event.params._minDelegationAmount
  audiusNetwork.save()

}

export function handleUndelegateLockupDurationUpdated(event: UndelegateLockupDurationUpdated): void {
  let audiusNetwork = AudiusNetwork.load('1')
  audiusNetwork.undelegateLockupDuration = event.params._undelegateLockupDuration
  audiusNetwork.save()

}

export function handleGovernanceAddressUpdated(event: GovernanceAddressUpdated): void {
  return
}

export function handleStakingAddressUpdated(event: StakingAddressUpdated): void {
  return
}

export function handleServiceProviderFactoryAddressUpdated(event: ServiceProviderFactoryAddressUpdated): void {
  return
}

export function handleClaimsManagerAddressUpdated(event: ClaimsManagerAddressUpdated): void {
  return
}

export function handleRemoveDelegatorLockupDurationUpdated(event: RemoveDelegatorLockupDurationUpdated): void {
  let audiusNetwork = AudiusNetwork.load('1')
  audiusNetwork.removeDelegatorLockupDuration = event.params._removeDelegatorLockupDuration
  audiusNetwork.save()
}

export function handleRemoveDelegatorEvalDurationUpdated(event: RemoveDelegatorEvalDurationUpdated): void {
  let audiusNetwork = AudiusNetwork.load('1')
  audiusNetwork.removeDelegatorEvalDuration = event.params._removeDelegatorEvalDuration
  audiusNetwork.save()
}
