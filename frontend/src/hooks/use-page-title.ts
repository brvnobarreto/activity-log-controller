import { useEffect } from 'react';

let currentTitle = '';

export const usePageTitle = (title: string) => {
  useEffect(() => {
    currentTitle = title;
    // Força re-render do AppLayout quando o título muda
    window.dispatchEvent(new CustomEvent('titleChanged', { detail: { title } }));
  }, [title]);
};

export const getCurrentTitle = () => currentTitle;
