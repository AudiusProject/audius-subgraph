import { BigInt } from "@graphprotocol/graph-ts"
import {
  ContractAdded,
  ContractRemoved,
  ContractUpgraded
} from '../types/Registry/Registry'
import {
  createOrLoadAudiusNetwork
} from './helpers'

export function handleContractAdded(event: ContractAdded): void {
  let audiusNetwork = createOrLoadAudiusNetwork()
}

export function handleContractRemoved(event: ContractRemoved): void {

}

export function handleContractUpgraded(event: ContractUpgraded): void {

}

