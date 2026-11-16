import React from 'react';
import { useTranslation } from 'react-i18next';

import { InitialFocus } from '@actual-app/components/initial-focus';
import { Input } from '@actual-app/components/input';
import { styles } from '@actual-app/components/styles';

import { NON_DRAGGABLE_AREA_CLASS_NAME } from './constants';
import { displayWidgetName } from './defaultReportNames';

type ReportCardNameProps = {
  name: string;
  isEditing: boolean;
  onChange: (newName: string) => void;
  onClose: () => void;
};

export const ReportCardName = ({
  name,
  isEditing,
  onChange,
  onClose,
}: ReportCardNameProps) => {
  const { t } = useTranslation();
  const shownName = displayWidgetName(name, t);
  // Saving a translated default name unchanged keeps the stored name as it is.
  const handleChange = (newName: string) => {
    if (shownName !== name && newName === shownName) {
      onClose();
    } else {
      onChange(newName);
    }
  };

  if (isEditing) {
    return (
      <InitialFocus>
        <Input
          className={NON_DRAGGABLE_AREA_CLASS_NAME}
          defaultValue={shownName}
          onEnter={handleChange}
          onUpdate={handleChange}
          onEscape={onClose}
          style={{
            ...styles.mediumText,
            marginTop: -6,
            marginBottom: -1,
            marginLeft: -6,
            width: Math.max(20, shownName.length) + 'ch',
          }}
        />
      </InitialFocus>
    );
  }

  return (
    <h2
      style={{
        display: 'block',
        margin: 0,
        padding: 0,
        ...styles.mediumText,
        marginBottom: 5,
      }}
    >
      {shownName}
    </h2>
  );
};
