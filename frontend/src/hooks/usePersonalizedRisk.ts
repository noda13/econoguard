import { useMemo } from 'react';
import { useUserProfile } from '../contexts/UserProfileContext';
import { personalizeRisk, getPersonalizedThresholds, getIndicatorRelevance } from '../lib/personalizedRisk';
import type { PersonalizedResult } from '../lib/types/profile';
import type { CompositeRisk, RiskAssessment } from '../services/api';

export function usePersonalizedRisk(
  compositeRisk: CompositeRisk | undefined,
  risks: RiskAssessment[] | undefined,
) {
  const { profile, isConfigured } = useUserProfile();

  const result = useMemo<PersonalizedResult | null>(() => {
    if (!isConfigured || !profile || !compositeRisk || !risks) return null;
    return personalizeRisk(compositeRisk, risks, profile);
  }, [isConfigured, profile, compositeRisk, risks]);

  const thresholds = useMemo(() => {
    if (!isConfigured || !profile) return null;
    return getPersonalizedThresholds(profile);
  }, [isConfigured, profile]);

  const getRelevance = useMemo(() => {
    if (!isConfigured || !profile) return null;
    return (code: string) => getIndicatorRelevance(code, profile.allocation);
  }, [isConfigured, profile]);

  return { result, thresholds, getRelevance, isConfigured };
}
