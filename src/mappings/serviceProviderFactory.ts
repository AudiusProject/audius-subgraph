import { BigInt, log } from '@graphprotocol/graph-ts'
import {
  RegisteredServiceProvider,
  DeregisteredServiceProvider,
  IncreasedStake,
  DecreaseStakeRequested,
  DecreaseStakeRequestCancelled,
  DecreaseStakeRequestEvaluated,
  EndpointUpdated,
  DelegateOwnerWalletUpdated,
  DeployerCutUpdateRequested,
  DeployerCutUpdateRequestCancelled,
  DeployerCutUpdateRequestEvaluated,
  DecreaseStakeLockupDurationUpdated,
  UpdateDeployerCutLockupDurationUpdated,
  GovernanceAddressUpdated,
  StakingAddressUpdated,
  ClaimsManagerAddressUpdated,
  DelegateManagerAddressUpdated,
  ServiceTypeManagerAddressUpdated,
  ServiceProviderFactory
} from '../types/ServiceProviderFactory/ServiceProviderFactory'
import {
  AudiusNetwork,
  ServiceNode,
  RegisteredServiceProviderEvent,
  DeregisteredServiceProviderEvent,
  IncreasedStakeEvent,
  UpdateDeployerCutEvent,
  DecreaseStakeEvent
} from '../types/schema'
import { getServiceId, createOrLoadUser, getRequestCountId, checkUserStakeDelegation } from './helpers'

export function handleRegisteredServiceProvider(event: RegisteredServiceProvider): void {
  // Create the service node
  let id = getServiceId(event.params._serviceType.toString(), event.params._spID.toString())
  let serviceNode = new ServiceNode(id)
  serviceNode.type = event.params._serviceType.toString()
  serviceNode.endpoint = event.params._endpoint
  let user = createOrLoadUser(event.params._owner, event.block.timestamp)

  // Query the ServiceProviderFactory contract for extra data
  let serviceProviderContract = ServiceProviderFactory.bind(event.address)
  let serviceEndpointInfo = serviceProviderContract.getServiceEndpointInfo(event.params._serviceType, event.params._spID)
  let serviceProviderDetails = serviceProviderContract.getServiceProviderDetails(event.params._owner)

  serviceNode.delegateOwnerWallet = serviceEndpointInfo.value3
  serviceNode.spId = event.params._spID
  serviceNode.owner = user.id
  serviceNode.isRegistered = true
  serviceNode.createdAt = event.block.timestamp.toI32()
  serviceNode.save()

  // Update the user Stake Amount
  let addedStake = event.params._stakeAmount.minus(user.stakeAmount).minus(user.delegationReceivedAmount)
  user.stakeAmount = serviceProviderDetails.value0
  user.minAccountStake = serviceProviderDetails.value4
  user.maxAccountStake = serviceProviderDetails.value5
  user.claimableStakeAmount = user.claimableStakeAmount.plus(addedStake) 
  user.totalClaimableAmount = user.claimableStakeAmount.plus(user.claimableDelegationSentAmount)
  user.hasStakeOrDelegation = true
  user.save()

  // Create the event
  let registerEvent = new RegisteredServiceProviderEvent(id)
  registerEvent.type = event.params._serviceType.toString()
  registerEvent.endpoint = event.params._endpoint
  registerEvent.owner = user.id
  registerEvent.spId = event.params._spID
  registerEvent.stakeAmount = event.params._stakeAmount
  registerEvent.node = serviceNode.id
  registerEvent.blockNumber = event.block.number
  registerEvent.save()

  // Update Global stake values
  let audiusNetwork = AudiusNetwork.load('1')
  audiusNetwork.totalTokensClaimable = audiusNetwork.totalTokensClaimable.plus(addedStake)
  audiusNetwork.totalTokensStaked = audiusNetwork.totalTokensStaked.plus(addedStake)
  audiusNetwork.save()
}

export function handleDeregisteredServiceProvider(event: DeregisteredServiceProvider): void {
  // Update the service node to be deregistered
  let id = getServiceId(event.params._serviceType.toString(), event.params._spID.toString())
  let serviceNode = ServiceNode.load(id)
  if (serviceNode === null) {
    log.error('No associated service to deregister: service type:{}, id:{}', [
      event.params._serviceType.toString(),
      event.params._spID.toString()
    ])
    return
  }
  serviceNode.isRegistered = false
  serviceNode.save()

  let serviceProviderContract = ServiceProviderFactory.bind(event.address)
  let serviceProviderDetails = serviceProviderContract.getServiceProviderDetails(event.params._owner)

  let user = createOrLoadUser(event.params._owner, event.block.timestamp)
  let numberEndpoints = serviceProviderDetails.value3
  if (numberEndpoints == BigInt.fromI32(0)){
    // Since this is the last service to be deregistered, a decrease stake request is created,
    // but no event is emitted, so we manually create a new decrease stake request for the user's stake amount
    let lockupDuration = serviceProviderContract.getDecreaseStakeLockupDuration()
    let decreaseAmount = user.stakeAmount
    let id = getRequestCountId()
    let decreaseStakeEvent = new DecreaseStakeEvent(id)
    decreaseStakeEvent.status = 'Requested'
    decreaseStakeEvent.owner = user.id
    decreaseStakeEvent.expiryBlock = event.block.number.plus(lockupDuration)
    decreaseStakeEvent.createdBlockNumber = event.block.number
    decreaseStakeEvent.decreaseAmount = decreaseAmount
    decreaseStakeEvent.save()

    user.pendingDecreaseStake = decreaseStakeEvent.id
    user.totalClaimableAmount = user.totalClaimableAmount.minus(decreaseAmount)
    user.claimableStakeAmount = user.claimableStakeAmount.minus(decreaseAmount)
    user.save()
  
    // Update Global stake values
    let audiusNetwork = AudiusNetwork.load('1')
    audiusNetwork.totalTokensClaimable = audiusNetwork.totalTokensClaimable.minus(decreaseAmount)
    audiusNetwork.totalTokensLocked = audiusNetwork.totalTokensLocked.plus(decreaseAmount)
    audiusNetwork.save()
  }

  user.minAccountStake = serviceProviderDetails.value4
  user.maxAccountStake = serviceProviderDetails.value5
  user.save()

  // Create the event
  let deregisterEvent = new DeregisteredServiceProviderEvent(id)
  deregisterEvent.type = event.params._serviceType.toString()
  deregisterEvent.endpoint = event.params._endpoint
  deregisterEvent.owner = event.params._owner.toHexString()
  deregisterEvent.spId = event.params._spID
  deregisterEvent.unstakeAmount = event.params._unstakeAmount
  deregisterEvent.node = serviceNode.id
  deregisterEvent.blockNumber = event.block.number
  deregisterEvent.save()
}

export function handleIncreasedStake(event: IncreasedStake): void {
  let serviceProviderContract = ServiceProviderFactory.bind(event.address)
  let serviceProviderDetails = serviceProviderContract.getServiceProviderDetails(event.params._owner)

  // Update the user stake amount
  let user = createOrLoadUser(event.params._owner, event.block.timestamp)
  user.stakeAmount = serviceProviderDetails.value0 // event.params._newStakeAmount
  user.claimableStakeAmount = user.claimableStakeAmount.plus(event.params._increaseAmount)
  user.totalClaimableAmount = user.claimableStakeAmount.plus(user.claimableDelegationSentAmount)
  user.save()

  // Create the event
  let id = event.transaction.from.toHex()
  let increaseStakeEvent = new IncreasedStakeEvent(id)
  increaseStakeEvent.owner = user.id
  increaseStakeEvent.newStakeAmount = event.params._newStakeAmount
  increaseStakeEvent.increaseAmount = event.params._increaseAmount
  increaseStakeEvent.blockNumber = event.block.number
  increaseStakeEvent.save()

  // Update Global stake values
  let audiusNetwork = AudiusNetwork.load('1')
  audiusNetwork.totalTokensClaimable = audiusNetwork.totalTokensClaimable.plus(event.params._increaseAmount)
  audiusNetwork.totalTokensStaked = audiusNetwork.totalTokensStaked.plus(event.params._increaseAmount)
  audiusNetwork.save()
}

export function handleDecreaseStakeRequested(event: DecreaseStakeRequested): void {
  let audiusNetwork = AudiusNetwork.load('1')
  let user = createOrLoadUser(event.params._owner, event.block.timestamp)

  let id = getRequestCountId()
  let decreaseStakeEvent = new DecreaseStakeEvent(id)
  decreaseStakeEvent.status = 'Requested'
  decreaseStakeEvent.owner = user.id
  decreaseStakeEvent.expiryBlock = event.params._lockupExpiryBlock
  decreaseStakeEvent.createdBlockNumber = event.block.number
  decreaseStakeEvent.decreaseAmount = event.params._decreaseAmount
  decreaseStakeEvent.save()

  // Since pending decrease stake events can be replaced, undo the "claimable" affect of the previous event
  if (user.pendingDecreaseStake !== null) {
    let previousDecreaseStakeEvent = DecreaseStakeEvent.load(user.pendingDecreaseStake)
    previousDecreaseStakeEvent.endedBlockNumber = event.block.number
    previousDecreaseStakeEvent.save()

    user.totalClaimableAmount = user.totalClaimableAmount.plus(previousDecreaseStakeEvent)
    user.claimableStakeAmount = user.claimableStakeAmount.plus(previousDecreaseStakeEvent)
  
    // Update Global stake values
    audiusNetwork.totalTokensClaimable = audiusNetwork.totalTokensClaimable.plus(previousDecreaseStakeEvent)
    audiusNetwork.totalTokensLocked = audiusNetwork.totalTokensLocked.minus(previousDecreaseStakeEvent)
  }

  user.pendingDecreaseStake = decreaseStakeEvent.id
  user.totalClaimableAmount = user.totalClaimableAmount.minus(event.params._decreaseAmount)
  user.claimableStakeAmount = user.claimableStakeAmount.minus(event.params._decreaseAmount)
  user.save()

  // Update Global stake values
  audiusNetwork.totalTokensClaimable = audiusNetwork.totalTokensClaimable.minus(event.params._decreaseAmount)
  audiusNetwork.totalTokensLocked = audiusNetwork.totalTokensLocked.plus(event.params._decreaseAmount)
  audiusNetwork.save()  
}

export function handleDecreaseStakeRequestCancelled(event: DecreaseStakeRequestCancelled): void {
  let user = createOrLoadUser(event.params._owner, event.block.timestamp)
  let decreaseStakeEventId = user.pendingDecreaseStake
  if (decreaseStakeEventId === null) {
    log.error('No associated decrease stake request to cancel: user:{}', [
      user.id
    ])
    return
  }
  let decreaseStakeEvent = DecreaseStakeEvent.load(decreaseStakeEventId)
  decreaseStakeEvent.status = 'Cancelled'
  decreaseStakeEvent.endedBlockNumber = event.block.number
  decreaseStakeEvent.save()

  user.pendingDecreaseStake = null
  user.totalClaimableAmount = user.totalClaimableAmount.plus(decreaseStakeEvent.decreaseAmount)
  user.claimableStakeAmount = user.claimableStakeAmount.plus(decreaseStakeEvent.decreaseAmount)
  user.save()

  // Update Global stake values
  let audiusNetwork = AudiusNetwork.load('1')
  audiusNetwork.totalTokensClaimable = audiusNetwork.totalTokensClaimable.plus(decreaseStakeEvent.decreaseAmount)
  audiusNetwork.totalTokensLocked = audiusNetwork.totalTokensLocked.minus(decreaseStakeEvent.decreaseAmount)
  audiusNetwork.save()
}

export function handleDecreaseStakeRequestEvaluated(event: DecreaseStakeRequestEvaluated): void {
  let user = createOrLoadUser(event.params._owner, event.block.timestamp)
  let decreaseStakeEventId = user.pendingDecreaseStake
  if (decreaseStakeEventId === null) {
    log.error('No associated decrease stake request to evaluate: user:{}', [
      user.id
    ])
    return
  }
  let decreaseStakeEvent = DecreaseStakeEvent.load(decreaseStakeEventId)
  decreaseStakeEvent.status = 'Evaluated'
  decreaseStakeEvent.endedBlockNumber = event.block.number
  decreaseStakeEvent.save()

  let serviceProviderContract = ServiceProviderFactory.bind(event.address)
  let serviceProviderDetails = serviceProviderContract.getServiceProviderDetails(event.params._owner)

  user.pendingDecreaseStake = null
  user.stakeAmount = serviceProviderDetails.value0 // event.params._newStakeAmount
  checkUserStakeDelegation(user)
  user.save()

  // Update Global stake values
  let audiusNetwork = AudiusNetwork.load('1')
  audiusNetwork.totalTokensLocked = audiusNetwork.totalTokensLocked.minus(decreaseStakeEvent.decreaseAmount)
  audiusNetwork.save()
}

export function handleDeployerCutUpdateRequested(event: DeployerCutUpdateRequested): void {
  let user = createOrLoadUser(event.params._owner, event.block.timestamp)

  let id = getRequestCountId()
  let updateDeployerCutEvent = new UpdateDeployerCutEvent(id)
  updateDeployerCutEvent.status = 'Requested'
  updateDeployerCutEvent.owner = user.id
  updateDeployerCutEvent.expiryBlock = event.params._lockupExpiryBlock
  updateDeployerCutEvent.createdBlockNumber = event.block.number
  updateDeployerCutEvent.updatedCut = event.params._updatedCut
  updateDeployerCutEvent.save()

  user.pendingUpdateDeployerCut = updateDeployerCutEvent.id
  user.save()
}

export function handleDeployerCutUpdateRequestCancelled(event: DeployerCutUpdateRequestCancelled): void {
  let user = createOrLoadUser(event.params._owner, event.block.timestamp)
  let updateDeployerCutEventId = user.pendingUpdateDeployerCut
  if (updateDeployerCutEventId === null) {
    log.error('No associated update deployer cut request to cancel: user:{}', [
      user.id
    ])
    return
  }
  let updateDeployerCutEvent = UpdateDeployerCutEvent.load(updateDeployerCutEventId)
  updateDeployerCutEvent.status = 'Cancelled'
  updateDeployerCutEvent.endedBlockNumber = event.block.number
  updateDeployerCutEvent.save()

  user.pendingUpdateDeployerCut = null
  user.save()
}

export function handleDeployerCutUpdateRequestEvaluated(event: DeployerCutUpdateRequestEvaluated): void {
  let user = createOrLoadUser(event.params._owner, event.block.timestamp)
  let updateDeployerCutEventId = user.pendingUpdateDeployerCut
  if (updateDeployerCutEventId === null) {
    log.error('No associated update deployer cut request to evaluate: user:{}', [
      user.id
    ])
    return
  }
  let updateDeployerCutEvent = UpdateDeployerCutEvent.load(updateDeployerCutEventId)
  updateDeployerCutEvent.status = 'Evaluated'
  updateDeployerCutEvent.endedBlockNumber = event.block.number
  updateDeployerCutEvent.save()

  user.pendingUpdateDeployerCut = null
  user.deployerCut = event.params._updatedCut
  user.save()
}

export function handleEndpointUpdated(event: EndpointUpdated): void {
  let serviceNodeId = getServiceId(event.params._serviceType.toString(), event.params._spID.toString())
  let serviceNode = ServiceNode.load(serviceNodeId)
  if (!serviceNode) {
    log.error('No associated service to update endpoint: service type:{}, spID:{}', [
      event.params._serviceType.toString(),
      event.params._spID.toString()
    ])
    return
  }
  serviceNode.endpoint = event.params._newEndpoint
  serviceNode.save()
}

export function handleDelegateOwnerWalletUpdated(event: DelegateOwnerWalletUpdated): void {
  let serviceNodeId = getServiceId(event.params._serviceType.toString(), event.params._spID.toString())
  let serviceNode = ServiceNode.load(serviceNodeId)
  if (!serviceNode) {
    log.error('No associated service to update owner wallet: service type:{}, spID:{}', [
      event.params._serviceType.toString(),
      event.params._spID.toString()
    ])
    return
  }
  serviceNode.delegateOwnerWallet = event.params._updatedWallet

  serviceNode.save()
}

// =========================== Update Audius Network Lockup Durations ===========================

export function handleDecreaseStakeLockupDurationUpdated(event: DecreaseStakeLockupDurationUpdated): void {
  let audiusNetwork = AudiusNetwork.load('1')
  audiusNetwork.decreaseStakeLockupDuration = event.params._lockupDuration
  audiusNetwork.save()
}

export function handleUpdateDeployerCutLockupDurationUpdated(event: UpdateDeployerCutLockupDurationUpdated): void {
  let audiusNetwork = AudiusNetwork.load('1')
  audiusNetwork.updateDeployerCutLockupDuration = event.params._lockupDuration
  audiusNetwork.save()
}

// =========================== Update Audius Network Addresses ===========================
export function handleGovernanceAddressUpdated(event: GovernanceAddressUpdated): void {
  let audiusNetwork = AudiusNetwork.load('1')
  audiusNetwork.governanceAddress = event.params._newGovernanceAddress
  audiusNetwork.save()
}

export function handleStakingAddressUpdated(event: StakingAddressUpdated): void {
  let audiusNetwork = AudiusNetwork.load('1')
  audiusNetwork.stakingAddress = event.params._newStakingAddress
  audiusNetwork.save()
}

export function handleClaimsManagerAddressUpdated(event: ClaimsManagerAddressUpdated): void {
  let audiusNetwork = AudiusNetwork.load('1')
  audiusNetwork.claimsManagerAddress = event.params._newClaimsManagerAddress
  audiusNetwork.save()
}

export function handleDelegateManagerAddressUpdated(event: DelegateManagerAddressUpdated): void {
  let audiusNetwork = AudiusNetwork.load('1')
  audiusNetwork.delegateManagerAddress = event.params._newDelegateManagerAddress
  audiusNetwork.save()
}

export function handleServiceTypeManagerAddressUpdated(event: ServiceTypeManagerAddressUpdated): void {
  let audiusNetwork = AudiusNetwork.load('1')
  audiusNetwork.serviceTypeManagerAddress = event.params._newServiceTypeManagerAddress
  audiusNetwork.save()
}

