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
import {
  buildOpenWeAgentCUIParams,
  createDigitalTwin,
  getQueryParam,
  getWeAgentDetails,
  openWeAgentCUI,
  resolveRobotIdForOpenWeAgentCUI,
  resolveWeCodeUrlForOpenWeAgentCUI,
} from '../utils/hwext';
import { closeCreateAssistantWindow, handleCreateForOtherScene, resolvePartnerAccount } from '../utils/createAssistantFlow';
import { WeLog } from '../utils/logger';
import { reportCoreFlowError } from '../utils/telemetry';
import { showToast } from '../utils/toast';
import '../styles/DigitalTwinCreator.less';

const SelectBrainAssistantPage: React.FC = () => {
  const { t } = useTranslation();
  const isPc = isPcMiniApp();
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = location.state as CreateAssistantRouteState | null;
  const draft = useMemo<DigitalTwinBasicInfoPayload | null>(() => routeState?.draft ?? null, [routeState]);
  const draftExists = Boolean(draft);
  const from = useMemo(() => getQueryParam('from', location.search) ?? '', [location.search]);


  const handleClose = useCallback(() => {
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

      let stage = 'createDigitalTwin';
      try {
        const createResult = await createDigitalTwin(params);
        const partnerAccount = resolvePartnerAccount(createResult);

        if (!partnerAccount) {
          WeLog(`SelectBrainAssistantPage createDigitalTwin returned invalid result | extra=${JSON.stringify({
            createResult,
          })}`);
          void reportCoreFlowError(
            'flow_create_assistant_error',
            '创建助手流程失败',
            new Error('createDigitalTwin returned missing partnerAccount'),
            {
              page: 'selectBrainAssistant',
              stage: 'missingPartnerAccount',
              from,
              weCrewType: params.weCrewType,
              bizRobotId: params.bizRobotId,
              isPc,
            },
          );
          showToast(t('createAssistant.createFailed'));
          return;
        }
        createResult.weCrewType = payload.digitalTwintype === 'internal' ? 1 : 0;
        if (from !== 'weAgent') {
          stage = 'handleCreateForOtherScene';
          await handleCreateForOtherScene(createResult);
          return;
        }

        stage = 'getWeAgentDetailsAfterCreate';
        const detailResult = await getWeAgentDetails({ partnerAccount });
        const detail = detailResult?.weAgentDetailsArray?.[0];
        if (!detail) {
          console.warn('getWeAgentDetails did not return detail for partnerAccount:', partnerAccount);
          void reportCoreFlowError(
            'flow_create_assistant_error',
            '创建助手流程失败',
            new Error('missing assistant detail after create'),
            {
              page: 'selectBrainAssistant',
              stage: 'missingAssistantDetailAfterCreate',
              from,
              partnerAccount,
              weCrewType: params.weCrewType,
              bizRobotId: params.bizRobotId,
              isPc,
            },
          );
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
          bizRobotTag: detail.bizRobotTag,
        });

        stage = 'openWeAgentCUIAfterCreate';
        await openWeAgentCUI(openParams);

        if (!isPc) {
          window.HWH5.close();
        }
      } catch (error) {
        WeLog(`SelectBrainAssistantPage confirmCreateAssistant failed | extra=${JSON.stringify({ from })} | error=${JSON.stringify(error)}`);
        void reportCoreFlowError('flow_create_assistant_error', '创建助手流程失败', error, {
          page: 'selectBrainAssistant',
          stage,
          from,
          weCrewType: params.weCrewType,
          bizRobotId: params.bizRobotId,
          isPc,
        });
        showToast(t('createAssistant.createFailed'));
      }
    },
    [draft, from, isPc, location.search, navigate, t],
  );

  useEffect(() => {
    if (draftExists) {
      return;
    }

    navigate(
      {
        pathname: "/createAssistant",
        search: location.search,
      },
      { replace: true },
    );
  }, [draftExists, location.search, navigate]);

  if (!draftExists) {
    return null;
  }

  return (
    <div className={`digital-twin-creator ${isPc ? 'is-pc' : 'is-mobile'}`.trim()}>
      <StepBrainSelect
        isPcMiniApp={isPc}
        onClose={handleClose}
        onPrev={handlePrev}
        onConfirm={handleConfirm}
      />
    </div>
  );
};

export default SelectBrainAssistantPage;
