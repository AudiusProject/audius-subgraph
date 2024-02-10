import {
  Staked,
  Unstaked,
  Slashed
} from '../types/Staking/Staking'
import {
  AudiusNetwork
} from '../types/schema'

export function handleStaked(event: Staked): void {
  let audiusNetwork = AudiusNetwork.load('1')
  if (audiusNetwork === null) return
  audiusNetwork.totalStaked = audiusNetwork.totalStaked.plus(event.params.amount)
  audiusNetwork.save()
}
export function handleUnstaked(event: Unstaked): void {
  let audiusNetwork = AudiusNetwork.load('1')
  if (audiusNetwork === null) return
  audiusNetwork.totalStaked = audiusNetwork.totalStaked.minus(event.params.amount)
  audiusNetwork.save()
}
export function handleSlashed(event: Slashed): void {
// Ignore this, look at delegate manager
}
