import { Link } from 'react-router'

/** The app's logo and name, linking to `to`. */
export function Brand({ to }: { to: string }) {
  return (
    <Link to={to} className="brand">
      <span className="brand-mark" aria-hidden="true">
        ⛽
      </span>
      MPG Logger
    </Link>
  )
}

const FEATURES = [
  {
    icon: '📝',
    title: 'Log a fill-up in seconds',
    text: 'Enter the date, your odometer, gallons and price. The previous reading is filled in for you.',
  },
  {
    icon: '🧮',
    title: 'The math is done for you',
    text: 'Miles driven, MPG and the cost of each fill-up are worked out as you type.',
  },
  {
    icon: '✏️',
    title: 'Fix mistakes easily',
    text: 'Edit or delete any entry. Later entries adjust, so your history always adds up.',
  },
  {
    icon: '🔒',
    title: 'Private to you',
    text: 'Your logs belong to your account. Passwords are encrypted, and you stay signed in until you sign out.',
  },
]

/** The first page visitors see: what the app does, with sign in / sign up at the top right. */
export default function Landing() {
  return (
    <div className="landing">
      <header className="topbar">
        <Brand to="/" />
        <nav className="topbar-actions" aria-label="Account">
          <Link to="/signin" className="button ghost">
            Sign in
          </Link>
          <Link to="/signup" className="button filled">
            Sign up
          </Link>
        </nav>
      </header>

      <main>
        <section className="hero">
          <div className="hero-text">
            <h1>Know what every mile costs you.</h1>
            <p className="lead">
              MPG Logger keeps track of your fill-ups and works out your fuel economy and spending, so you
              can see how your car is really doing.
            </p>
            <div className="hero-actions">
              <Link to="/signup" className="button filled large">
                Get started, it’s free
              </Link>
              <Link to="/signin" className="button ghost large">
                I have an account
              </Link>
            </div>
          </div>

          {/* A sample history row, styled like the real app. */}
          <div className="hero-preview card" aria-hidden="true">
            <div className="row">
              <span className="headline">Oct 15, 2026</span>
              <span className="pill">32.4 MPG</span>
            </div>
            <div className="row">
              <span>Miles driven</span>
              <span>324 mi</span>
            </div>
            <div className="row">
              <span>Gallons</span>
              <span>10.00</span>
            </div>
            <div className="row">
              <span>Cost</span>
              <span>$34.90</span>
            </div>
          </div>
        </section>

        <section className="features" aria-labelledby="features-title">
          <h2 id="features-title" className="section-title">
            Everything you need, nothing you don’t
          </h2>
          <div className="feature-grid">
            {FEATURES.map((f) => (
              <article className="feature card" key={f.title}>
                <span className="feature-icon" aria-hidden="true">
                  {f.icon}
                </span>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="steps" aria-labelledby="steps-title">
          <h2 id="steps-title" className="section-title">
            How it works
          </h2>
          <ol className="step-list">
            <li>
              <strong>Create an account</strong>
              <span>Just a username, your name and a password.</span>
            </li>
            <li>
              <strong>Log each fill-up</strong>
              <span>Note your odometer when you buy gas.</span>
            </li>
            <li>
              <strong>Watch the trends</strong>
              <span>See your MPG and costs for every tank.</span>
            </li>
          </ol>
          <Link to="/signup" className="button filled large">
            Create your account
          </Link>
        </section>
      </main>

      <footer className="landing-footer secondary">MPG Logger</footer>
    </div>
  )
}
