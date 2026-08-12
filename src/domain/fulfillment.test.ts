import { describe, expect, it } from 'vitest';
import {
  calculateFulfillmentLandedCost,
  deriveInvoiceDisplayStatus,
  rankFulfillmentServices,
  type FulfillmentRequest,
  type FulfillmentService,
} from './fulfillment';

const request: FulfillmentRequest = {
  destination: 'taiwan-main-island',
  deliveryMode: 'home',
  temperature: 'ambient',
  paymentMode: 'prepaid',
  orderAmountTwd: 1_000,
  weightGrams: 800,
  volumeCm3: 4_000,
  promisedWithinHours: 72,
};

const baseService: FulfillmentService = {
  id: 'home-a',
  enabled: true,
  destinations: ['taiwan-main-island'],
  deliveryModes: ['home'],
  temperatures: ['ambient'],
  paymentModes: ['prepaid', 'cod'],
  maxWeightGrams: 20_000,
  maxVolumeCm3: 120_000,
  baseCostTwd: 80,
  estimatedMaxDeliveryHours: 48,
};

describe('fulfillment routing', () => {
  it('filters services by destination, mode, temperature, dimensions, restrictions and SLA', () => {
    const eligible = rankFulfillmentServices(request, [
      baseService,
      { ...baseService, id: 'offshore-only', destinations: ['taiwan-offshore'] },
      { ...baseService, id: 'store-only', deliveryModes: ['convenience-store'] },
      { ...baseService, id: 'too-small', maxWeightGrams: 500 },
      { ...baseService, id: 'too-slow', estimatedMaxDeliveryHours: 96 },
      { ...baseService, id: 'liquid-blocked', blockedRestrictions: ['liquid'] },
    ]).eligible;

    expect(eligible.map((candidate) => candidate.service.id)).toEqual([
      'home-a',
      'liquid-blocked',
    ]);

    expect(rankFulfillmentServices(
      { ...request, productRestrictions: ['liquid'] },
      [{ ...baseService, id: 'liquid-blocked', blockedRestrictions: ['liquid'] }],
    )).toMatchObject({
      eligible: [],
      requiresManualSelection: true,
      reason: 'no_eligible_service',
    });
  });

  it('calculates complete COD and destination cost from verified inputs', () => {
    expect(calculateFulfillmentLandedCost(
      { ...request, destination: 'taiwan-offshore', paymentMode: 'cod' },
      {
        ...baseService,
        destinations: ['taiwan-offshore'],
        baseCostTwd: 90,
        platformFeeTwd: 10,
        destinationSurchargesTwd: { 'taiwan-offshore': 40 },
        codRate: 0.007,
        codMinimumFeeTwd: 30,
      },
    )).toBe(170);
  });

  it('uses delivery performance only after both services have 30 days of evidence', () => {
    const fastReliable = {
      ...baseService,
      id: 'fast-reliable',
      evidenceDays: 30,
      deliverySuccessRate: 0.99,
      averageDeliveryHours: 22,
      manualPriority: 9,
    };
    const slower = {
      ...baseService,
      id: 'slower',
      evidenceDays: 60,
      deliverySuccessRate: 0.96,
      averageDeliveryHours: 30,
      manualPriority: 1,
    };

    expect(rankFulfillmentServices(request, [slower, fastReliable])).toMatchObject({
      requiresManualSelection: false,
      eligible: [
        { service: { id: 'fast-reliable' } },
        { service: { id: 'slower' } },
      ],
    });

    const insufficient = rankFulfillmentServices(request, [
      { ...fastReliable, evidenceDays: 29 },
      slower,
    ]);
    expect(insufficient.requiresManualSelection).toBe(true);
    expect(insufficient.reason).toBe('insufficient_performance_evidence');
    expect(insufficient.eligible[0].service.id).toBe('slower');
  });

  it('rejects invalid package input rather than guessing', () => {
    expect(() => rankFulfillmentServices(
      { ...request, weightGrams: Number.NaN },
      [baseService],
    )).toThrow('finite and non-negative');
  });
});

describe('invoice state projection', () => {
  it('never infers invoice issuance from payment status', () => {
    expect(deriveInvoiceDisplayStatus({
      providerConfigured: true,
      paymentStatus: 'paid',
    })).toBe('awaiting-provider');

    expect(deriveInvoiceDisplayStatus({
      providerConfigured: true,
      paymentStatus: 'refunded',
      providerStatus: 'voided',
    })).toBe('voided');

    expect(deriveInvoiceDisplayStatus({
      providerConfigured: false,
      paymentStatus: 'paid',
      providerStatus: 'issued',
    })).toBe('not-configured');
  });
});
