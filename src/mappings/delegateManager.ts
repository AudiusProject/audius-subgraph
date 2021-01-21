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
} from '../types/DelegateManager/DelegateManager'
import {
  AudiusNetwork
} from '../types/schema'


export function handleIncreaseDelegatedStake(event: IncreaseDelegatedStake): void {
  return
}
export function handleUndelegateStakeRequested(event: UndelegateStakeRequested): void {
  return
}
export function handleUndelegateStakeRequestCancelled(event: UndelegateStakeRequestCancelled): void {
  return
}
export function handleUndelegateStakeRequestEvaluated(event: UndelegateStakeRequestEvaluated): void {
  return
}
export function handleClaim(event: Claim): void {
  return
}
export function handleSlash(event: Slash): void {
  return
}
export function handleRemoveDelegatorRequested(event: RemoveDelegatorRequested): void {
  return
}
export function handleRemoveDelegatorRequestCancelled(event: RemoveDelegatorRequestCancelled): void {
  return
}
export function handleRemoveDelegatorRequestEvaluated(event: RemoveDelegatorRequestEvaluated): void {
  return
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
