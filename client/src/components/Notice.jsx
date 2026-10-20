import { CircleAlert, CircleCheck, Info } from 'lucide-react';
export default function Notice({ type = 'info', children }) {
  const Icon = type === 'error' ? CircleAlert : type === 'success' ? CircleCheck : Info;
  return <div className={`notice notice-${type}`} role={type === 'error' ? 'alert' : 'status'} aria-live={type === 'error' ? 'assertive' : 'polite'}><Icon size={17} /><div>{children}</div></div>;
}
