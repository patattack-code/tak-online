import { Link } from 'react-router';

export function SetupPage() {
  return (
    <div className="setup card">
      <h1>Almost there: connect Firebase</h1>
      <p>Online play, sign-in and statistics need a Firebase project. The practice board works without one.</p>
      <ol className="steps">
        <li>
          Create a project at <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer">console.firebase.google.com</a>.
        </li>
        <li>
          <strong>Authentication → Sign-in method</strong>: enable <em>Google</em>.
        </li>
        <li>
          <strong>Firestore Database</strong>: create a database (production mode is fine; the rules in this repo are deployed later).
        </li>
        <li>
          <strong>Project settings → Your apps → Add app → Web</strong>: register the app and copy the <code>firebaseConfig</code> values.
        </li>
        <li>
          Copy <code>.env.example</code> to <code>.env.local</code>, paste the values, and restart <code>npm run dev</code>.
        </li>
        <li>
          Deploy rules and indexes: <code>firebase login</code>, <code>firebase use --add</code>, then <code>firebase deploy --only firestore</code>.
        </li>
      </ol>
      <p>
        Meanwhile, <Link to="/practice">open the practice board</Link>.
      </p>
    </div>
  );
}
