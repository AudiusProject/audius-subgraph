import { BigInt } from '@graphprotocol/graph-ts'
import {
  RoundInitiated,
  ClaimProcessed,
  CommunityRewardsTransferred,
  FundingAmountUpdated,
  FundingRoundBlockDiffUpdated,
  GovernanceAddressUpdated,
  StakingAddressUpdated,
  ServiceProviderFactoryAddressUpdated,
  DelegateManagerAddressUpdated,
  RecurringCommunityFundingAmountUpdated,
  CommunityPoolAddressUpdated,
  ClaimsManager
} from '../types/ClaimsManager/ClaimsManager'
import {
  AudiusNetwork,
  ClaimRound,
  ClaimEvent,
  ClaimEventAmount
} from '../types/schema'
import { 
  createOrLoadUser,
  createOrLoadDelegate
} from './helpers'
import {
  DelegateManager
} from '../types/DelegateManager/DelegateManager'
import { Staking } from '../types/Staking/Staking'


export function handleRoundInitiated(event: RoundInitiated): void {
  let id = event.params._roundNumber.toString()
  let claimRound = new ClaimRound(id)
  claimRound.blockNumber = event.block.number
  claimRound.fundAmount = event.params._fundAmount
  claimRound.save()
}

export function handleClaimProcessed(event: ClaimProcessed): void {
  let id = event.transaction.from.toHex()
  let claimer = createOrLoadUser(event.params._claimer, event.block.timestamp)
  let claimEvent = new ClaimEvent(id)
  claimEvent.rewards = event.params._rewards
  claimEvent.blockNumber = event.block.number
  claimEvent.claimer = claimer.id
  claimEvent.newTotal = event.params._newTotal
  claimEvent.save()
  let audiusNetwork = AudiusNetwork.load('1')

  // Query all delegators of the claimer and for each, fetch their delegation amount
  let claimsManagerContract = ClaimsManager.bind(event.address)
  let delegateManagerAddress = claimsManagerContract.getDelegateManagerAddress()
  let stakingAddress = claimsManagerContract.getStakingAddress()
  let delegateManagerContract = DelegateManager.bind(delegateManagerAddress)
  let stakingContract = Staking.bind(stakingAddress)

  let totalClaimerDelegated = delegateManagerContract.getTotalDelegatedToServiceProvider(event.params._claimer)
  let totalClaimedDelegatedLocked = delegateManagerContract.getTotalLockedDelegationForServiceProvider(event.params._claimer)
  let totalStakedAmount = stakingContract.totalStakedFor(event.params._claimer)
  let pendingDecreaseStakeAmount = claimer.stakeAmount.minus(claimer.claimableStakeAmount)
  let prevStaked = claimer.stakeAmount 

  claimer.delegationReceivedAmount = totalClaimerDelegated
  claimer.claimableDelegationReceivedAmount = totalClaimerDelegated.minus(totalClaimedDelegatedLocked)

  claimer.stakeAmount = totalStakedAmount.minus(claimer.delegationReceivedAmount)
  let updatedClaimableStakeAmount = claimer.stakeAmount.minus(pendingDecreaseStakeAmount)
  let claimerDiffAmount = updatedClaimableStakeAmount.minus(claimer.claimableStakeAmount)
  claimer.claimableStakeAmount = updatedClaimableStakeAmount
  claimer.totalClaimableAmount = claimer.claimableStakeAmount.plus(claimer.claimableDelegationSentAmount)
  claimer.save()

  // Save the individual sp'd increase during the claim
  let claimEventAmount = new ClaimEventAmount(id.concat(claimer.id))
  claimEventAmount.claimEvent = claimEvent.id
  claimEventAmount.rewards = claimerDiffAmount
  claimEventAmount.user = claimer.id
  claimEventAmount.save()

  let addedTokensStaked = claimer.stakeAmount.minus(prevStaked)
  
  audiusNetwork.totalTokensStaked = audiusNetwork.totalTokensStaked.plus(addedTokensStaked)
  audiusNetwork.totalTokensDelegated = audiusNetwork.totalTokensDelegated.plus(event.params._rewards.minus(addedTokensStaked))

  // Handle all the delegators
  let delegators = delegateManagerContract.getDelegatorsList(event.params._claimer)
  for (let i = 0; i < delegators.length; ++i) {
    let delegatorAddress = delegators[i]
    let delegateAmount = delegateManagerContract.getDelegatorStakeForServiceProvider(delegatorAddress, event.params._claimer)
    let delegate = createOrLoadDelegate(event.params._claimer, delegatorAddress)
    let pendingDecreaseAmount = delegate.amount.minus(delegate.claimableAmount)
    let delegationDiff = delegateAmount.minus(delegate.amount)
    delegate.claimableAmount = delegateAmount.minus(pendingDecreaseAmount)
    delegate.amount = delegateAmount
    delegate.save()

    if (delegationDiff.gt(BigInt.fromI32(0))) {
      let delegator = createOrLoadUser(delegatorAddress, event.block.timestamp)
      delegator.claimableDelegationSentAmount = delegator.claimableDelegationSentAmount.plus(delegationDiff)
      delegator.delegationSentAmount = delegator.delegationSentAmount.plus(delegationDiff)
      delegator.totalClaimableAmount = delegator.totalClaimableAmount.plus(delegationDiff)
      delegator.save()

      let claimEventAmountId = id.concat(delegator.id)
      let claimEventAmount = new ClaimEventAmount(claimEventAmountId)
      claimEventAmount.claimEvent = claimEvent.id
      claimEventAmount.rewards = delegationDiff
      claimEventAmount.user = delegator
      claimEventAmount.save()
    }
  }

  audiusNetwork.totalTokensClaimable = audiusNetwork.totalTokensClaimable.plus(event.params._rewards)
  audiusNetwork.save()
}

export function handleCommunityRewardsTransferred(event: CommunityRewardsTransferred): void {
  return
}

export function handleFundingAmountUpdated(event: FundingAmountUpdated): void {
  let audiusNetwork = AudiusNetwork.load('1')
  audiusNetwork.fundingAmount = event.params._amount
  audiusNetwork.save()
}

export function handleFundingRoundBlockDiffUpdated(event: FundingRoundBlockDiffUpdated): void {
  let audiusNetwork = AudiusNetwork.load('1')
  audiusNetwork.fundingRoundBlockDiff = event.params._blockDifference
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

export function handleDelegateManagerAddressUpdated(event: DelegateManagerAddressUpdated): void {
  return
}

export function handleRecurringCommunityFundingAmountUpdated(event: RecurringCommunityFundingAmountUpdated): void {
  let audiusNetwork = AudiusNetwork.load('1')
  audiusNetwork.recurringCommunityFundingAmount = event.params._amount
  audiusNetwork.save()
}

export function handleCommunityPoolAddressUpdated(event: CommunityPoolAddressUpdated): void {
  let audiusNetwork = AudiusNetwork.load('1')
  audiusNetwork.communityPoolAddress = event.params._newCommunityPoolAddress
  audiusNetwork.save()
}