import React, { useCallback } from 'react';
import hideIcon from '../../imgs/hide_icon.svg';
import starIcon from '../../imgs/star_icon.svg';
import { controlSkillWeCode } from '../../utils/hwext';
import { WeLog } from '../../utils/logger';

export const SkillCUIHeader: React.FC = () => {
  const handleMinimize = useCallback(async () => {
    try {
      await controlSkillWeCode({ action: 'minimize' });
    } catch (err) {
      WeLog(`SkillCUIHeader minimize failed | error=${JSON.stringify(err)}`);
    } finally {
      window.HWH5?.close?.();
    }
  }, []);

  return (
    <div className="skill-cui-header">
      <div className="skill-cui-header__title">
        <img
          className="skill-cui-header__title-icon"
          src={starIcon}
          alt=""
          aria-hidden="true"
          draggable="false"
        />
        <span className="skill-cui-header__title-text">AI技能</span>
      </div>
      <div className="skill-cui-header__actions">
        <button
          type="button"
          className="skill-cui-header__btn"
          onClick={() => {
            void handleMinimize();
          }}
          aria-label="最小化"
        >
          <img className="skill-cui-header__icon" src={hideIcon} alt="" draggable="false" />
        </button>
      </div>
    </div>
  );
};
