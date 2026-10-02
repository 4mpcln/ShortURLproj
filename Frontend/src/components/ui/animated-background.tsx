import './animated-background.css';

export default function AnimatedBackground() {
  return (
    <div className="animated-background" aria-hidden="true">
      <div className="animated-background__grid" />
      <div className="animated-background__light" />
      <div className="animated-background__texture" />
      <div className="animated-background__vignette" />
      <div className="animated-background__overlay" />
    </div>
  );
}
