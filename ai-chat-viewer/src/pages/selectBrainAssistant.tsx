import React, { useCallback, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { StepBrainSelect } from '../components/createAssistant/StepBrainSelect';
import { isPcMiniApp } from '../constants';
import type {
  CreateAssistantRouteState,
  CreateDigitalTwinParams,
  DigitalTwinBasicInfoPayload,
  DigitalTwinBrainPayload,
} from '../types/digitalTwin';
import type { CreateDigitalTwinResult } from '../types/bridge';
import {
  buildOpenWeAgentCUIParams,
  createDigitalTwin,
  getAgentType,
  getQueryParam,
  getWeAgentDetails,
  openWeAgentCUI,
  resolveRobotIdForOpenWeAgentCUI,
  resolveWeCodeUrlForOpenWeAgentCUI,
} from '../utils/hwext';
import { WeLog } from '../utils/logger';
import { showToast } from '../utils/toast';
import '../styles/DigitalTwinCreator.less';

function resolvePartnerAccount(result: CreateDigitalTwinResult): string {
  const value = result?.partnerAccount;
  return typeof value === 'string' ? value.trim() : '';
}

function closeCreateAssistantWindow(): void {
  if (typeof window !== 'undefined' && (window as any).Pedestal?.remote?.getCurrentWindow) {
    (window as any).Pedestal.remote.getCurrentWindow().close();
  }
}

const SelectBrainAssistantPage: React.FC = () => {
  const { t } = useTranslation();
  const isPc = isPcMiniApp();
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = location.state as CreateAssistantRouteState | null;
  const draft = useMemo<DigitalTwinBasicInfoPayload | null>(() => routeState?.draft ?? null, [routeState]);
  const draftExists = Boolean(draft);
  const from = useMemo(() => getQueryParam('from', location.search) ?? '', [location.search]);

  useEffect(() => {
    if (draftExists) {
      return;
    }

    navigate(
      {
        pathname: '/createAssistant',
        search: location.search,
      },
      { replace: true },
    );
  }, [draftExists, location.search, navigate]);

  if (!draftExists) {
    return null;
  }

  const handleClose = useCallback(() => {
    closeCreateAssistantWindow();
  }, []);

  const handleCancel = useCallback(() => {
    closeCreateAssistantWindow();
  }, []);

  const handlePrev = useCallback(() => {
    navigate(
      {
        pathname: '/createAssistant',
        search: location.search,
      },
      {
        replace: true,
        state: draft ? ({ draft } satisfies CreateAssistantRouteState) : undefined,
      },
    );
  }, [draft, location.search, navigate]);

  const handleConfirm = useCallback(
    async (payload: DigitalTwinBrainPayload) => {
      const basicInfo = draft;
      if (!basicInfo) {
        navigate(
          {
            pathname: '/createAssistant',
            search: location.search,
          },
          { replace: true },
        );
        return;
      }

      const params: CreateDigitalTwinParams = {
        name: basicInfo.name,
        icon: basicInfo.icon,
        description: basicInfo.description,
        weCrewType: payload.digitalTwintype === 'internal' ? 1 : 0,
      };

      if (payload.digitalTwintype === 'internal' && payload.bizRobotId) {
        params.bizRobotId = payload.bizRobotId;
      }

      try {
        const createResult = await createDigitalTwin(params);
        const partnerAccount = resolvePartnerAccount(createResult);

        if (!partnerAccount) {
          WeLog(`SelectBrainAssistantPage createDigitalTwin returned invalid result | extra=${JSON.stringify({
            createResult,
          })}`);
          showToast(t('createAssistant.createFailed'));
          return;
        }

        if (from !== 'weAgent') {
          if (!isPc) {
            if (typeof window.HWH5.openIMChat === 'function') {
              await window.HWH5.openIMChat({ chatId: partnerAccount });
            } else {
              window.HWH5.close();
            }
          } else if (typeof window !== 'undefined' && window.Pedestal?.callMethod) {
            await window.Pedestal.callMethod('method://agentSkills/handleSdk', { owner: partnerAccount });
          }
          return;
        }

        const detailResult = await getWeAgentDetails({ partnerAccount });
        const detail = detailResult?.weAgentDetailsArray?.[0];
        if (!detail) {
          console.warn('getWeAgentDetails did not return detail for partnerAccount:', partnerAccount);
          return;
        }

        const weCodeUrl = resolveWeCodeUrlForOpenWeAgentCUI(detail, partnerAccount);
        const robotId = resolveRobotIdForOpenWeAgentCUI({
          detailId: detail.id,
          createRobotId: createResult.robotId,
        });
        const openParams = buildOpenWeAgentCUIParams(weCodeUrl, partnerAccount, {
          bizRobotId: detail.bizRobotId,
          robotId,
        });

        await openWeAgentCUI(openParams);

        if (!isPc) {
          window.HWH5.close();
        }
      } catch (error) {
        WeLog(`SelectBrainAssistantPage confirmCreateAssistant failed | extra=${JSON.stringify({ from })} | error=${JSON.stringify(error)}`);
        showToast(t('createAssistant.createFailed'));
      }
    },
    [draft, from, isPc, location.search, navigate, t],
  );

  return (
    <div className={`digital-twin-creator ${isPc ? 'is-pc' : 'is-mobile'}`.trim()}>
      <StepBrainSelect
        isPcMiniApp={isPc}
        onClose={handleClose}
        onCancel={handleCancel}
        onPrev={handlePrev}
        onConfirm={handleConfirm}
        loadAgentTypes={async () => {
          const result = await getAgentType();
          return result && Array.isArray(result.content) ? result.content : [];
        }}
      />
    </div>
  );
};

export default SelectBrainAssistantPage;
