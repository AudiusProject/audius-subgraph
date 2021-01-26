
import { Approval, Transfer, AudiusToken } from '../types/AudiusToken/AudiusToken'
import { createOrLoadUser } from './helpers'
import { AudiusNetwork } from '../types/schema'

/**
 * @dev handleTransfer
 * - updates graphNetwork, creates if needed
 * - updates accounts, creates if needed
 */
export function handleTransfer(event: Transfer): void {
  let audiusNetwork = AudiusNetwork.load('1')

  let to = event.params.to
  let from = event.params.from
  let value = event.params.value
  let userTo = createOrLoadUser(to, event.block.timestamp)
  let userFrom = createOrLoadUser(from, event.block.timestamp)

  // Mint Transfer
  if (from.toHexString() == '0x0000000000000000000000000000000000000000') {
    audiusNetwork.totalSupply = audiusNetwork.totalSupply.plus(value)
    audiusNetwork.totalAUDIOMinted = audiusNetwork.totalAUDIOMinted.plus(value)
    audiusNetwork.save()
    userTo.balance = userTo.balance.plus(value)

    // Burn Transfer
  } else if (to.toHexString() == '0x0000000000000000000000000000000000000000') {
    audiusNetwork.totalSupply = audiusNetwork.totalSupply.minus(value)
    audiusNetwork.totalAUDIOBurned = audiusNetwork.totalAUDIOBurned.plus(value)
    audiusNetwork.save()

    userFrom.balance = userFrom.balance.minus(value)

    // Normal Transfer
  } else {
    userTo.balance = userTo.balance.plus(value)
    userFrom.balance = userFrom.balance.minus(value)
  }


  userTo.save()
  userFrom.save()
}

export function handleApproval(event: Approval): void {
  // TODO: ?
}