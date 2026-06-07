interface Props {
  onPlay: () => void;
}

export default function MainMenu({ onPlay }: Props) {
  return (
    <div className="screen menu-screen">
      <div className="menu-content">
        <div className="logo-area">
          <h1 className="logo-title">
            <span className="logo-jp">日本語</span>
            <span className="logo-beats">BEATS</span>
          </h1>
          <p className="logo-tagline">Learn kanji through rhythm</p>
        </div>

        <div className="menu-lanes">
          {['日', '月', '火', '水'].map((k, i) => (
            <div key={i} className={`menu-lane lane-${i}`}>
              <span>{k}</span>
            </div>
          ))}
        </div>

        <div className="menu-actions">
          <button className="btn btn-primary btn-large" onClick={onPlay}>
            PLAY
          </button>
        </div>

        <div className="menu-hint">
          <p>4-key · 7-key · 3 learning modes</p>
        </div>
      </div>
    </div>
  );
}
