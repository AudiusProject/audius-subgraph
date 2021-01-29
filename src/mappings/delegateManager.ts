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
  getRequestCountId,
  checkUserStakeDelegation
} from './helpers'


export function handleClaim(event: Claim): void {
  // NOTE: This is event is handled in the claimsManager
}

export function handleSlash(event: Slash): void {
  return
}

export function handleIncreaseDelegatedStake(event: IncreaseDelegatedStake): void {
  // Update serviceProvider props
  let serviceProvider = createOrLoadUser(event.params._serviceProvider, event.block.timestamp)
  serviceProvider.claimableDelegationReceivedAmount = serviceProvider.claimableDelegationReceivedAmount.plus(event.params._increaseAmount)
  serviceProvider.delegationReceivedAmount = serviceProvider.delegationReceivedAmount.plus(event.params._increaseAmount)
  serviceProvider.save()

  // Update delegators props
  let delegator = createOrLoadUser(event.params._delegator, event.block.timestamp)
  delegator.claimableDelegationSentAmount = delegator.claimableDelegationSentAmount.plus(event.params._increaseAmount)
  delegator.delegationSentAmount = delegator.delegationSentAmount.plus(event.params._increaseAmount)
  delegator.totalClaimableAmount = delegator.totalClaimableAmount.plus(event.params._increaseAmount)
  delegator.hasStakeOrDelegation = true
  delegator.save()

  // Update delegate props
  let delegate = createOrLoadDelegate(event.params._serviceProvider, event.params._delegator)
  delegate.amount = delegate.amount.plus(event.params._increaseAmount)
  delegate.claimableAmount = delegate.claimableAmount.plus(event.params._increaseAmount)
  delegate.save()

  // Create event
  let eventId = event.transaction.from.toHex()
  let increaseDelegatedStakeEvent = new IncreaseDelegatedStakeEvent(eventId)
  increaseDelegatedStakeEvent.delegator = delegator.id
  increaseDelegatedStakeEvent.serviceProvider = serviceProvider.id
  increaseDelegatedStakeEvent.blockNumber = event.block.number
  increaseDelegatedStakeEvent.increaseAmount = event.params._increaseAmount
  increaseDelegatedStakeEvent.save()

  // Update Global stake values
  let audiusNetwork = AudiusNetwork.load('1')
  audiusNetwork.totalTokensClaimable = audiusNetwork.totalTokensClaimable.plus(event.params._increaseAmount)
  audiusNetwork.totalTokensDelegated = audiusNetwork.totalTokensStaked.plus(event.params._increaseAmount)
  audiusNetwork.save()
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

  // Update Global stake values
  let audiusNetwork = AudiusNetwork.load('1')
  audiusNetwork.totalTokensClaimable = audiusNetwork.totalTokensClaimable.minus(event.params._amount)
  audiusNetwork.totalTokensLocked = audiusNetwork.totalTokensStaked.plus(event.params._amount)
  audiusNetwork.save()
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

  // Update Global stake values
  let audiusNetwork = AudiusNetwork.load('1')
  audiusNetwork.totalTokensClaimable = audiusNetwork.totalTokensClaimable.plus(event.params._amount)
  audiusNetwork.totalTokensLocked = audiusNetwork.totalTokensStaked.minus(event.params._amount)
  audiusNetwork.save()
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
  delegator.delegationSentAmount = delegator.delegationSentAmount.minus(event.params._amount)
  checkUserStakeDelegation(delegator)
  delegator.pendingUndelegateStake = null
  delegator.save()

  serviceProvider.delegationReceivedAmount = serviceProvider.delegationReceivedAmount.minus(event.params._amount)
  checkUserStakeDelegation(serviceProvider)
  serviceProvider.save()

  let delegate = createOrLoadDelegate(event.params._serviceProvider, event.params._delegator)
  delegate.amount = delegate.amount.minus(event.params._amount)
  delegate.save()


  // Update Global stake values
  let audiusNetwork = AudiusNetwork.load('1')
  audiusNetwork.totalTokensDelegated = audiusNetwork.totalTokensDelegated.minus(event.params._amount)
  audiusNetwork.totalTokensLocked = audiusNetwork.totalTokensStaked.minus(event.params._amount)
  audiusNetwork.save()
}

export function handleRemoveDelegatorRequested(event: RemoveDelegatorRequested): void {
  let serviceProvider = createOrLoadUser(event.params._serviceProvider, event.block.timestamp)
  let delegator = createOrLoadUser(event.params._delegator, event.block.timestamp)

  let id = getRequestCountId()
  let removeDelegatorEvent = new RemoveDelegatorEvent(id)
  removeDelegatorEvent.status = 'Requested'
  removeDelegatorEvent.owner = serviceProvider.id
  removeDelegatorEvent.delegator = delegator.id
  removeDelegatorEvent.expiryBlock = event.params._lockupExpiryBlock
  removeDelegatorEvent.createdBlockNumber = event.block.number
  removeDelegatorEvent.save()

  serviceProvider.pendingRemoveDelegator = removeDelegatorEvent.id
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
  let delegator = createOrLoadUser(event.params._delegator, event.block.timestamp)
  let removeDelegatorEventId = serviceProvider.pendingRemoveDelegator
  if (removeDelegatorEventId === null) {
    return
  }
  let removeDelegatorEvent = RemoveDelegatorEvent.load(removeDelegatorEventId)
  removeDelegatorEvent.status = 'Evaluated'
  removeDelegatorEvent.endedBlockNumber = event.block.number
  removeDelegatorEvent.save()

  serviceProvider.claimableDelegationReceivedAmount = serviceProvider.claimableDelegationReceivedAmount.minus(event.params._unstakedAmount)
  serviceProvider.delegationReceivedAmount = serviceProvider.delegationReceivedAmount.minus(event.params._unstakedAmount)
  serviceProvider.pendingRemoveDelegator = null
  checkUserStakeDelegation(serviceProvider)
  serviceProvider.save()

  delegator.claimableDelegationSentAmount = delegator.claimableDelegationSentAmount.minus(event.params._unstakedAmount)
  delegator.delegationSentAmount = delegator.delegationSentAmount.minus(event.params._unstakedAmount)
  delegator.totalClaimableAmount = delegator.totalClaimableAmount.minus(event.params._unstakedAmount)
  checkUserStakeDelegation(delegator)
  delegator.save()

  let delegate = createOrLoadDelegate(event.params._serviceProvider, event.params._delegator)
  delegate.amount = BigInt.fromI32(0)
  delegate.claimableAmount = BigInt.fromI32(0)
  delegate.save()

  // Update Global stake values
  let audiusNetwork = AudiusNetwork.load('1')
  audiusNetwork.totalTokensClaimable = audiusNetwork.totalTokensClaimable.minus(event.params._unstakedAmount)
  audiusNetwork.totalTokensDelegated = audiusNetwork.totalTokensDelegated.minus(event.params._unstakedAmount)
  audiusNetwork.save()
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
