import { BigInt, log } from '@graphprotocol/graph-ts'
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
  RemoveDelegatorEvent,
  UndelegateStakeEvent,
  IncreaseDelegatedStakeEvent,
  SlashEvent,
  DecreaseStakeEvent
} from '../types/schema'
import { 
  createOrLoadUser,
  createOrLoadDelegate,
  getRequestCountId,
  checkUserStakeDelegation
} from './helpers'


export function handleClaim(event: Claim): void {
  // NOTE: This is event is handled in the claimsManager
}

export function handleSlash(event: Slash): void {
  // Any pending decrease stake is remove from the service provider => cancelled
  // Cancel all decrease delegation to that service provider

  let id = event.transaction.from.toHex()
  let slashedUser = createOrLoadUser(event.params._target, event.block.timestamp)
  let slashEvent = new SlashEvent(id)
  slashEvent.amount = event.params._amount
  slashEvent.target = slashedUser.id
  slashEvent.newTotal = event.params._newTotal
  slashEvent.blockNumber = event.block.number
  slashEvent.save()
  let audiusNetwork = AudiusNetwork.load('1')

  let delegateManagerContract = DelegateManager.bind(event.address)
  let stakingAddress = delegateManagerContract.getStakingAddress()
  let stakingContract = Staking.bind(stakingAddress)

  let totalSlashedUserDelegated = delegateManagerContract.getTotalDelegatedToServiceProvider(event.params._target)
  let totalSlashedUserDelegatedLocked = delegateManagerContract.getTotalLockedDelegationForServiceProvider(event.params._target)
  let totalStakedAmount = stakingContract.totalStakedFor(event.params._target)
  let prevStaked = slashedUser.stakeAmount 

  // All pending decrease delegation are cancelled
  slashedUser.delegationReceivedAmount = totalSlashedUserDelegated
  slashedUser.claimableDelegationReceivedAmount = totalSlashedUserDelegated

  slashedUser.claimableDelegationReceivedAmount = totalSlashedUserDelegated.minus(totalSlashedUserDelegatedLocked)

  // The pending decrease stake request is cancelled
  slashedUser.stakeAmount = totalStakedAmount.minus(slashedUser.delegationReceivedAmount)
  slashedUser.claimableStakeAmount = slashedUser.stakeAmount
  slashedUser.totalClaimableAmount = slashedUser.claimableStakeAmount.plus(slashedUser.claimableDelegationSentAmount)
  slashedUser.save()

  if (slashedUser.pendingDecreaseStake != null) {
    let decreaseStakeEvent = DecreaseStakeEvent.load(slashedUser.pendingDecreaseStake)
    decreaseStakeEvent.status = 'Cancelled'
    decreaseStakeEvent.endedBlockNumber = event.block.number
    decreaseStakeEvent.save()
  }

  let removedTokens = prevStaked.minus(slashedUser.stakeAmount)
  
  audiusNetwork.totalTokensStaked = audiusNetwork.totalTokensStaked.minus(removedTokens)
  audiusNetwork.totalTokensDelegated = audiusNetwork.totalTokensDelegated.minus(event.params._amount.minus(removedTokens))

  // Handle all the delegators
  let delegators = delegateManagerContract.getDelegatorsList(event.params._target)
  for (let i = 0; i < delegators.length; ++i) {
    let delegatorAddress = delegators[i]
    let delegator = createOrLoadUser(delegatorAddress, event.block.timestamp)
    let delegateAmount = delegateManagerContract.getDelegatorStakeForServiceProvider(delegatorAddress, event.params._target)
    let delegate = createOrLoadDelegate(event.params._target, delegatorAddress)
    let delegationDiff = delegate.amount.minus(delegateAmount)

    delegate.claimableAmount = delegateAmount
    delegate.amount = delegateAmount
    delegate.save()

    if (delegator.pendingUndelegateStake != null) {
      let undelegateStakeEvent = UndelegateStakeEvent.load(delegator.pendingUndelegateStake)
      undelegateStakeEvent.status = 'Cancelled'
      undelegateStakeEvent.endedBlockNumber = event.block.number
      undelegateStakeEvent.save()

      let pendingDecreaseAmount = undelegateStakeEvent.amount 
      delegator.claimableDelegationSentAmount = delegator.claimableDelegationSentAmount.plus(pendingDecreaseAmount)
      delegator.totalClaimableAmount = delegator.totalClaimableAmount.plus(pendingDecreaseAmount)
    }

    delegator.pendingUndelegateStake = null
    delegator.claimableDelegationSentAmount = delegator.claimableDelegationSentAmount.minus(delegationDiff)
    delegator.delegationSentAmount = delegator.delegationSentAmount.minus(delegationDiff)
    delegator.totalClaimableAmount = delegator.totalClaimableAmount.minus(delegationDiff)
    delegator.save() 
  }

  audiusNetwork.totalTokensClaimable = audiusNetwork.totalTokensClaimable.minus(event.params._amount)
  audiusNetwork.save()
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
    log.error('No associated undelegate stake request to cancel: delegator:{}, service provider:{}', [
      delegator.id,
      serviceProvider.id
    ])
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
    log.error('No associated undelegate stake request to evaluate: delegator:{}, service provider:{}', [
      delegator.id,
      serviceProvider.id
    ])
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

  let id = event.params._serviceProvider.toHexString() + event.params._delegator.toHexString()
  let removeDelegatorEvent = RemoveDelegatorEvent.load(id)
  if (removeDelegatorEvent == null) {
    removeDelegatorEvent = new RemoveDelegatorEvent(id)
  }
  removeDelegatorEvent.status = 'Requested'
  removeDelegatorEvent.owner = serviceProvider.id
  removeDelegatorEvent.delegator = delegator.id
  removeDelegatorEvent.expiryBlock = event.params._lockupExpiryBlock
  removeDelegatorEvent.createdBlockNumber = event.block.number
  removeDelegatorEvent.save()
}

export function handleRemoveDelegatorRequestCancelled(event: RemoveDelegatorRequestCancelled): void {
  let serviceProvider = createOrLoadUser(event.params._serviceProvider, event.block.timestamp)

  let removeDelegatorEventId = event.params._serviceProvider.toHexString() + event.params._delegator.toHexString()
  let removeDelegatorEvent = RemoveDelegatorEvent.load(removeDelegatorEventId)

  if (removeDelegatorEvent === null) {
    log.error('No remove delegator event for service provider :{}', [
      serviceProvider.id
    ])
    return
  }

  removeDelegatorEvent.status = 'Cancelled'
  removeDelegatorEvent.endedBlockNumber = event.block.number
  removeDelegatorEvent.save()
}

export function handleRemoveDelegatorRequestEvaluated(event: RemoveDelegatorRequestEvaluated): void {
  let serviceProvider = createOrLoadUser(event.params._serviceProvider, event.block.timestamp)
  let delegator = createOrLoadUser(event.params._delegator, event.block.timestamp)

  let removeDelegatorEventId = event.params._serviceProvider.toHexString() + event.params._delegator.toHexString()
  let removeDelegatorEvent = RemoveDelegatorEvent.load(removeDelegatorEventId)
  if (removeDelegatorEvent === null) {
    log.error('No remove delegator event for service provider :{}', [
      serviceProvider.id
    ])
    return
  }
  removeDelegatorEvent.status = 'Evaluated'
  removeDelegatorEvent.endedBlockNumber = event.block.number
  removeDelegatorEvent.save()

  serviceProvider.claimableDelegationReceivedAmount = serviceProvider.claimableDelegationReceivedAmount.minus(event.params._unstakedAmount)
  serviceProvider.delegationReceivedAmount = serviceProvider.delegationReceivedAmount.minus(event.params._unstakedAmount)
  checkUserStakeDelegation(serviceProvider)

  let audiusNetwork = AudiusNetwork.load('1')
  let delegate = createOrLoadDelegate(event.params._serviceProvider, event.params._delegator)

  let undelegateStakeId = delegator.pendingUndelegateStake
  if (undelegateStakeId !== null) {
    let undelegateStakeEvent = UndelegateStakeEvent.load(undelegateStakeId)
    if (undelegateStakeEvent.serviceProvider.id === serviceProvider.id) {
      delegator.totalClaimableAmount = delegator.totalClaimableAmount.plus(undelegateStakeEvent.amount)
      delegator.claimableDelegationSentAmount = delegator.claimableDelegationSentAmount.plus(undelegateStakeEvent.amount)
      delegator.pendingUndelegateStake = undelegateStakeEvent.id

      serviceProvider.claimableDelegationReceivedAmount = serviceProvider.claimableDelegationReceivedAmount.plus(undelegateStakeEvent.amount)

      audiusNetwork.totalTokensClaimable = audiusNetwork.totalTokensClaimable.plus(undelegateStakeEvent.amount)
      audiusNetwork.totalTokensLocked = audiusNetwork.totalTokensStaked.minus(undelegateStakeEvent.amount)

    }
  }
  serviceProvider.save()


  delegator.claimableDelegationSentAmount = delegator.claimableDelegationSentAmount.minus(event.params._unstakedAmount)
  delegator.delegationSentAmount = delegator.delegationSentAmount.minus(event.params._unstakedAmount)
  delegator.totalClaimableAmount = delegator.totalClaimableAmount.minus(event.params._unstakedAmount)
  checkUserStakeDelegation(delegator)
  delegator.save()

  delegate.amount = BigInt.fromI32(0)
  delegate.claimableAmount = BigInt.fromI32(0)
  delegate.save()

  // Update Global stake values
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
