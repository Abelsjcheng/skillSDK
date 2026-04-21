import React, { useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { StepBasicInfo } from '../components/createAssistant/StepBasicInfo';
import { DEFAULT_AVATARS } from '../components/createAssistant/constants';
import { isPcMiniApp } from '../constants';
import type { CreateAssistantRouteState, DigitalTwinBasicInfoPayload } from '../types/digitalTwin';
import '../styles/DigitalTwinCreator.less';

function closeCreateAssistantWindow(): void {
  if (typeof window !== 'undefined' && (window as any).Pedestal?.remote?.getCurrentWindow) {
    (window as any).Pedestal.remote.getCurrentWindow().close();
  }
}

const CreateAssistantBasicPage: React.FC = () => {
  const isPc = isPcMiniApp();
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = location.state as CreateAssistantRouteState | null;
  const initialValue = useMemo(() => routeState?.draft ?? null, [routeState]);

  const handleClose = useCallback(() => {
    closeCreateAssistantWindow();
  }, []);

  const handleCancel = useCallback(() => {
    closeCreateAssistantWindow();
  }, []);

  const handleNext = useCallback((payload: DigitalTwinBasicInfoPayload) => {
    navigate(
      {
        pathname: '/selectBrainAssistant',
        search: location.search,
      },
      {
        state: {
          draft: payload,
        } satisfies CreateAssistantRouteState,
      },
    );
  }, [location.search, navigate]);

  return (
    <div className={`digital-twin-creator ${isPc ? 'is-pc' : 'is-mobile'}`.trim()}>
      <StepBasicInfo
        isPcMiniApp={isPc}
        defaultAvatars={DEFAULT_AVATARS}
        initialValue={initialValue}
        onClose={handleClose}
        onCancel={handleCancel}
        onNext={handleNext}
      />
    </div>
  );
};

export default CreateAssistantBasicPage;
