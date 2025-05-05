'use client';

import React, { forwardRef } from 'react';

interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  containerClassName?: string;
  labelClassName?: string;
  inputClassName?: string;
  required?: boolean;
  icon?: React.ReactNode;
}

const InputField = forwardRef<HTMLInputElement, InputFieldProps>(
  (
    {
      label,
      error,
      hint,
      containerClassName = '',
      labelClassName = '',
      inputClassName = '',
      required = false,
      icon,
      ...props
    },
    ref
  ) => {
    return (
      <div className={`mb-4 ${containerClassName}`}>
        {label && (
          <label
            htmlFor={props.id}
            className={`block text-sm font-medium text-gray-700 mb-1 ${labelClassName}`}
          >
            {label} {required && <span className="text-red-500">*</span>}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            className={`
              appearance-none block w-full px-4 py-3 
              border ${error ? 'border-red-500' : 'border-gray-300'} 
              rounded-lg shadow-sm 
              placeholder-gray-400 
              focus:outline-none focus:ring-2 
              focus:ring-indigo-500 focus:border-indigo-500
              ${icon ? 'pl-10' : ''}
              ${inputClassName}
            `}
            {...props}
          />
        </div>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        {hint && !error && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
      </div>
    );
  }
);

InputField.displayName = 'InputField';

export default InputField; 