import React from 'react';
import activateGuide1 from '../imgs/activate-guide-1.svg';
import '../styles/ActivateAssistant.less';

const ActivateAssistant: React.FC = () => {
  const handleEnableNow = () => {};

  return (
    <div className="activate-assistant">
      <section className="activate-assistant__content">
        <div className="activate-assistant__carousel">
          <img src={activateGuide1} alt="激活助理引导图" className="activate-assistant__image" />
        </div>
      </section>

      <section className="activate-assistant__actions">
        <button type="button" className="activate-assistant__enable-btn" onClick={handleEnableNow}>
          立即启用
        </button>
      </section>
    </div>
  );
};

export default ActivateAssistant;
