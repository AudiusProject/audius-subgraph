import {
  ContractAdded,
  ContractRemoved,
  ContractUpgraded
} from '../types/Registry/Registry'
import {
  Governance
} from '../types/Governance/Governance'
import {
  DelegateManager
} from '../types/DelegateManager/DelegateManager'
import {
  ServiceProviderFactory
} from '../types/ServiceProviderFactory/ServiceProviderFactory'
import {
  createOrLoadAudiusNetwork
} from './helpers'


export function handleContractAdded(event: ContractAdded): void {
  let audiusNetwork = createOrLoadAudiusNetwork()
  
  let name = event.params._name.toString()
  let address = event.params._address
  if (name == "Governance") {
    audiusNetwork.governanceAddress = address
    let governanceContract = Governance.bind(address)
    let votingPeriod = governanceContract.getVotingPeriod()
    let votingQuorumPercent = governanceContract.getVotingQuorumPercent()
    let executionDelay = governanceContract.getExecutionDelay()
    let maxInProgressProposals = governanceContract.getMaxInProgressProposals()
    audiusNetwork.votingPeriod = votingPeriod
    audiusNetwork.votingQuorumPercent = votingQuorumPercent
    audiusNetwork.executionDelay = executionDelay
    audiusNetwork.maxInProgressProposals = maxInProgressProposals
  } else if (name == "StakingProxy") {
    audiusNetwork.stakingAddress = address
  } else if (name == "ServiceProviderFactory") {
    audiusNetwork.serviceProviderFactoryAddress = address
    let serviceProviderFactoryContract = ServiceProviderFactory.bind(address)
    let decreaseStakeLockupDuration = serviceProviderFactoryContract.getDecreaseStakeLockupDuration()
    let updateDeployerCutLockupDuration = serviceProviderFactoryContract.getDeployerCutLockupDuration()
    audiusNetwork.decreaseStakeLockupDuration = decreaseStakeLockupDuration
    audiusNetwork.updateDeployerCutLockupDuration = updateDeployerCutLockupDuration
  } else if (name == "ClaimsManagerProxy") {
    audiusNetwork.claimsManagerAddress = address
  } else if (name == "DelegateManager") {
    audiusNetwork.delegateManagerAddress = address
    let delegatemanagerContract = DelegateManager.bind(address)
    let undelegateLockupDuration = delegatemanagerContract.getUndelegateLockupDuration()
    audiusNetwork.undelegateLockupDuration = undelegateLockupDuration
  } else if (name == "ServiceTypeManagerProxy") {
    audiusNetwork.serviceTypeManagerAddress = address
  } else if (name == "Registry") {
    audiusNetwork.registryAddress = address
  } else if (name == "Token") {
    audiusNetwork.audiusTokenAddress = address
  }
  audiusNetwork.save()
}

export function handleContractRemoved(event: ContractRemoved): void {
  // TODO: ignore for now.
  return
}

export function handleContractUpgraded(event: ContractUpgraded): void {
  // TODO: ignore for now.
  return
}

