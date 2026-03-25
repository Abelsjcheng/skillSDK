import React from 'react';
import assistantAvatar from '../imgs/assistant-avatar.svg';
import '../styles/AssistantDetail.less';
import AssistantPageHeader from '../components/assistant/AssistantPageHeader';

interface DetailInfoRowProps {
  label: string;
  value: string;
}

const DetailInfoRow: React.FC<DetailInfoRowProps> = ({ label, value }) => (
  <div className="assistant-detail__info-row">
    <span className="assistant-detail__info-label">{label}</span>
    <span className="assistant-detail__info-value">{value}</span>
  </div>
);

const AssistantDetail: React.FC = () => {
  return (
    <div className="assistant-detail">
      <AssistantPageHeader title="助理详情" />

      <main className="assistant-detail__content">
        <section className="assistant-detail__card assistant-detail__card--profile">
          <div className="assistant-detail__avatar">
            <img src={assistantAvatar} alt="助理头像" className="assistant-detail__avatar-img" />
          </div>
          <div className="assistant-detail__name-row">
            <span className="assistant-detail__name">小咪</span>
            <span className="assistant-detail__tag">员工助手</span>
          </div>
        </section>

        <section className="assistant-detail__card assistant-detail__card--intro">
          <h3 className="assistant-detail__section-title">助理简介</h3>
          <p className="assistant-detail__section-desc">你的全能AI生活助理</p>
          <DetailInfoRow label="创建者" value="小米" />
        </section>

        <section className="assistant-detail__card assistant-detail__card--org">
          <DetailInfoRow label="部门" value="测试" />
          <DetailInfoRow label="责任人" value="测试" />
        </section>
      </main>
    </div>
  );
};

export default AssistantDetail;
