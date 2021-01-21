import { BigInt, Bytes } from '@graphprotocol/graph-ts'
import {
  User,
  ServiceNode,
  ServiceType,
  AudiusNetwork
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
    user.claimableDelegationAmount = BigInt.fromI32(0)
    user.stakeAmount = BigInt.fromI32(0)
    user.delegationAmount = BigInt.fromI32(0)
  
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
    audiusNetwork.save()
  }

  return audiusNetwork as AudiusNetwork
}


export function getRequestCountId(): string {
  let audiusNetwork = createOrLoadAudiusNetwork()
  let updatedCount = audiusNetwork.requestCount.plus(BigInt.fromI32(1)) as BigInt
  audiusNetwork.requestCount = updatedCount
  audiusNetwork.save()

  return updatedCount.toString()
}
