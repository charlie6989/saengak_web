export type DestinationZone = 'taiwan-main-island' | 'taiwan-offshore' | 'international';
export type DeliveryMode = 'home' | 'convenience-store';
export type TemperatureBand = 'ambient' | 'chilled' | 'frozen';
export type PaymentMode = 'prepaid' | 'cod';

export interface FulfillmentRequest {
  destination: DestinationZone;
  deliveryMode: DeliveryMode;
  temperature: TemperatureBand;
  paymentMode: PaymentMode;
  orderAmountTwd: number;
  weightGrams: number;
  volumeCm3: number;
  productRestrictions?: string[];
  promisedWithinHours?: number;
}

export interface FulfillmentService {
  id: string;
  enabled: boolean;
  destinations: DestinationZone[];
  deliveryModes: DeliveryMode[];
  temperatures: TemperatureBand[];
  paymentModes: PaymentMode[];
  maxWeightGrams: number;
  maxVolumeCm3: number;
  blockedRestrictions?: string[];
  baseCostTwd: number;
  platformFeeTwd?: number;
  destinationSurchargesTwd?: Partial<Record<DestinationZone, number>>;
  codRate?: number;
  codMinimumFeeTwd?: number;
  estimatedMaxDeliveryHours?: number;
  evidenceDays?: number;
  deliverySuccessRate?: number;
  averageDeliveryHours?: number;
  manualPriority?: number;
}

export interface RankedFulfillmentService {
  service: FulfillmentService;
  landedCostTwd: number;
  performanceEvidenceReady: boolean;
}

export interface FulfillmentRankingResult {
  eligible: RankedFulfillmentService[];
  requiresManualSelection: boolean;
  reason?: 'no_eligible_service' | 'insufficient_performance_evidence';
}

const isFiniteNonNegative = (value: number) => Number.isFinite(value) && value >= 0;

function validateRequest(request: FulfillmentRequest) {
  if (
    !isFiniteNonNegative(request.orderAmountTwd) ||
    !isFiniteNonNegative(request.weightGrams) ||
    !isFiniteNonNegative(request.volumeCm3)
  ) {
    throw new Error('Fulfillment request amounts and dimensions must be finite and non-negative');
  }
}

function hasPerformanceEvidence(service: FulfillmentService): boolean {
  return (
    (service.evidenceDays ?? 0) >= 30 &&
    typeof service.deliverySuccessRate === 'number' &&
    Number.isFinite(service.deliverySuccessRate) &&
    service.deliverySuccessRate >= 0 &&
    service.deliverySuccessRate <= 1 &&
    typeof service.averageDeliveryHours === 'number' &&
    isFiniteNonNegative(service.averageDeliveryHours)
  );
}

function isEligible(request: FulfillmentRequest, service: FulfillmentService): boolean {
  if (!service.enabled) return false;
  if (!service.destinations.includes(request.destination)) return false;
  if (!service.deliveryModes.includes(request.deliveryMode)) return false;
  if (!service.temperatures.includes(request.temperature)) return false;
  if (!service.paymentModes.includes(request.paymentMode)) return false;
  if (request.weightGrams > service.maxWeightGrams) return false;
  if (request.volumeCm3 > service.maxVolumeCm3) return false;
  if (
    request.promisedWithinHours != null &&
    (service.estimatedMaxDeliveryHours == null ||
      service.estimatedMaxDeliveryHours > request.promisedWithinHours)
  ) {
    return false;
  }

  const blocked = new Set(service.blockedRestrictions ?? []);
  return !(request.productRestrictions ?? []).some((restriction) => blocked.has(restriction));
}

export function calculateFulfillmentLandedCost(
  request: FulfillmentRequest,
  service: FulfillmentService,
): number {
  validateRequest(request);
  const platformFee = service.platformFeeTwd ?? 0;
  const destinationSurcharge = service.destinationSurchargesTwd?.[request.destination] ?? 0;
  const codRate = service.codRate ?? 0;
  const codMinimumFee = service.codMinimumFeeTwd ?? 0;
  if (
    !isFiniteNonNegative(service.baseCostTwd) ||
    !isFiniteNonNegative(platformFee) ||
    !isFiniteNonNegative(destinationSurcharge) ||
    !isFiniteNonNegative(codRate) ||
    codRate > 1 ||
    !isFiniteNonNegative(codMinimumFee)
  ) {
    throw new Error(`Fulfillment service ${service.id} contains an invalid cost`);
  }

  const baseCost = service.baseCostTwd + platformFee;
  const codFee = request.paymentMode === 'cod'
    ? Math.max(
      codMinimumFee,
      request.orderAmountTwd * codRate,
    )
    : 0;

  const total = baseCost + destinationSurcharge + codFee;
  if (!isFiniteNonNegative(total)) {
    throw new Error(`Fulfillment service ${service.id} contains an invalid cost`);
  }
  return Number(total.toFixed(2));
}

export function rankFulfillmentServices(
  request: FulfillmentRequest,
  services: FulfillmentService[],
): FulfillmentRankingResult {
  validateRequest(request);

  const eligible = services
    .filter((service) => isEligible(request, service))
    .map((service, sourceIndex) => ({
      service,
      sourceIndex,
      landedCostTwd: calculateFulfillmentLandedCost(request, service),
      performanceEvidenceReady: hasPerformanceEvidence(service),
    }))
    .sort((left, right) => {
      const costDifference = left.landedCostTwd - right.landedCostTwd;
      if (costDifference !== 0) return costDifference;

      if (left.performanceEvidenceReady && right.performanceEvidenceReady) {
        const successDifference =
          (right.service.deliverySuccessRate as number) -
          (left.service.deliverySuccessRate as number);
        if (successDifference !== 0) return successDifference;

        const speedDifference =
          (left.service.averageDeliveryHours as number) -
          (right.service.averageDeliveryHours as number);
        if (speedDifference !== 0) return speedDifference;
      }

      const priorityDifference =
        (left.service.manualPriority ?? Number.MAX_SAFE_INTEGER) -
        (right.service.manualPriority ?? Number.MAX_SAFE_INTEGER);
      return priorityDifference || left.sourceIndex - right.sourceIndex;
    })
    .map(({ sourceIndex: _sourceIndex, ...candidate }) => candidate);

  if (eligible.length === 0) {
    return {
      eligible,
      requiresManualSelection: true,
      reason: 'no_eligible_service',
    };
  }

  const performanceEvidenceReady = eligible.every((candidate) => candidate.performanceEvidenceReady);
  return {
    eligible,
    requiresManualSelection: !performanceEvidenceReady,
    reason: performanceEvidenceReady ? undefined : 'insufficient_performance_evidence',
  };
}

export type InvoiceProviderStatus = 'issued' | 'voided' | 'allowance-issued' | 'failed';
export type InvoiceDisplayStatus =
  | 'not-configured'
  | 'awaiting-provider'
  | InvoiceProviderStatus;

export interface InvoiceStateInput {
  providerConfigured: boolean;
  paymentStatus?: string;
  providerStatus?: InvoiceProviderStatus;
}

export function deriveInvoiceDisplayStatus(input: InvoiceStateInput): InvoiceDisplayStatus {
  if (!input.providerConfigured) return 'not-configured';
  return input.providerStatus ?? 'awaiting-provider';
}
