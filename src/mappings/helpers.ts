import { BigInt, Bytes } from '@graphprotocol/graph-ts'
import {
  User,
  ServiceNode,
  ServiceType,
  AudiusNetwork,
  Delegate
} from '../types/schema'

export function createOrLoadUser(
  address: Bytes,
  timestamp: BigInt
): User {
  let user = User.load(address.toHexString())
  if (user == null) {
    user = new User(address.toHexString())
    user.createdAt = timestamp
    user.deployerCut = BigInt.fromI32(0)
    user.totalClaimableAmount = BigInt.fromI32(0)
    user.claimableStakeAmount = BigInt.fromI32(0)
    user.claimableDelegationReceivedAmount = BigInt.fromI32(0)
    user.claimableDelegationSentAmount = BigInt.fromI32(0)
    user.stakeAmount = BigInt.fromI32(0)
    user.delegationReceivedAmount = BigInt.fromI32(0)
    user.delegationSentAmount = BigInt.fromI32(0)
    user.balance = BigInt.fromI32(0)
    user.minAccountStake = BigInt.fromI32(0)
    user.maxAccountStake = BigInt.fromI32(0)
    user.validBounds = true
    user.hasStakeOrDelegation = false
    user.save()
  }

  return user as User
}

export function getServiceId(
  serviceType: string,
  serviceId: string
): string {
  return serviceType + '::' + serviceId
}


export function createOrLoadAudiusNetwork(): AudiusNetwork {
  let audiusNetwork = AudiusNetwork.load('1')

  if (audiusNetwork == null) {
    audiusNetwork = new AudiusNetwork('1')
    audiusNetwork.requestCount = BigInt.fromI32(0)
    audiusNetwork.totalSupply = BigInt.fromI32(0)
    audiusNetwork.totalAUDIOMinted = BigInt.fromI32(0)
    audiusNetwork.totalAUDIOBurned = BigInt.fromI32(0)
    audiusNetwork.totalTokensStaked = BigInt.fromI32(0)
    audiusNetwork.totalTokensClaimable = BigInt.fromI32(0)
    audiusNetwork.totalTokensLocked = BigInt.fromI32(0)
    audiusNetwork.totalTokensDelegated = BigInt.fromI32(0)
    audiusNetwork.totalStaked = BigInt.fromI32(0)
    audiusNetwork.save()
  }

  return audiusNetwork as AudiusNetwork
}


export function createOrLoadDelegate(
  serviceProvider: Bytes,
  delegator: Bytes
): Delegate {
  let id = serviceProvider.toHexString() + delegator.toHexString()
  let delegate = Delegate.load(id)
  if (delegate == null) {
    delegate = new Delegate(id)
    delegate.amount = BigInt.fromI32(0)
    delegate.claimableAmount = BigInt.fromI32(0)
    delegate.fromUser = delegator.toHexString()
    delegate.toUser = serviceProvider.toHexString()
    delegate.save()
  }
  return delegate as Delegate
}


export function getRequestCountId(): string {
  let audiusNetwork = createOrLoadAudiusNetwork()
  let updatedCount = audiusNetwork.requestCount.plus(BigInt.fromI32(1)) as BigInt
  audiusNetwork.requestCount = updatedCount
  audiusNetwork.save()

  return updatedCount.toString()
}

export function checkUserStakeDelegation(user: User): void {
  if (user.delegationReceivedAmount.le(BigInt.fromI32(0)) && user.totalClaimableAmount.le(BigInt.fromI32(0))) {
    user.hasStakeOrDelegation = false
  }
}

export function getVoteId(proposalId: string, userId: string): string {
  return proposalId + '::' + userId
}

export function getVoteType(num: u32): string|null {
  switch (num) {
    case 0:
      return 'None'
    case 1:
      return 'No'
    case 2:
      return 'Yes'
    default:
      return null
    }
}

export function getProposalOutcome(num: u32): string|null {
  switch (num) {
    case 0:
      return 'InProgress'
    case 1:
      return 'Rejected'
    case 2:
      return 'ApprovedExecuted'
    case 3:
      return 'QuorumNotMet'
    case 4:
      return 'ApprovedExecutionFailed'
    case 5:
      return 'Evaluating'
    case 6:
      return 'Vetoed'
    case 7:
      return 'TargetContractAddressChanged'
    case 8:
      return 'TargetContractCodeHashChanged'
    default:
      return null
    }
}
