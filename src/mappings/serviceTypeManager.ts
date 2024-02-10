import {
  SetServiceVersion,
  ServiceTypeAdded,
  ServiceTypeRemoved
} from '../types/ServiceTypeManager/ServiceTypeManager'
import {
  ServiceType,
  ServiceTypeVersion
} from '../types/schema'

export function handleSetServiceVersion(event: SetServiceVersion): void {
  let serviceTypeVersion = new ServiceTypeVersion(event.transaction.from.toHex())
  serviceTypeVersion.serviceType = event.params._serviceType.toString()
  serviceTypeVersion.serviceVersion = event.params._serviceVersion.toString()
  serviceTypeVersion.blockNumber = event.block.number

  serviceTypeVersion.save()
}

export function handleServiceTypeAdded(event: ServiceTypeAdded): void {
  let serviceType = new ServiceType(event.params._serviceType.toString())
  serviceType.minStake = event.params._serviceTypeMin
  serviceType.maxStake = event.params._serviceTypeMax
  serviceType.isValid = true
  serviceType.save()
}

export function handleServiceTypeRemoved(event: ServiceTypeRemoved): void {
  let serviceType = ServiceType.load(event.params._serviceType.toString())
  if (serviceType === null) return
  serviceType.isValid = false
  serviceType.save()
}
