import React from 'react';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>
        <h2 className="modal-title">About Crisis Management Dashboard</h2>
        
        <section className="modal-section">
          <h3>Origin & Vision</h3>
          <p>
            This project started as a curiosity-driven exploration but evolved into something much more significant. 
            Through development and research, it became clear that this dashboard could serve as a powerful tool for 
            global awareness and decision-making.
          </p>
        </section>

        <section className="modal-section">
          <h3>Use Cases</h3>
          <ul>
            <li>Market Movement Prediction: Track global events that might impact financial markets</li>
            <li>Risk Assessment: Monitor potential threats and crisis situations in real-time</li>
            <li>Global Awareness: Stay informed about worldwide developments and their interconnections</li>
            <li>Strategic Planning: Use crisis data to inform business and travel decisions</li>
            <li>Emergency Response: Quick access to critical information during crisis situations</li>
          </ul>
        </section>

        <section className="modal-section">
          <h3>Development Context</h3>
          <p>
            Built during the Acta Global Hackathon, this project showcases the potential of real-time 
            crisis monitoring and data visualization. The platform demonstrates how technology can be 
            leveraged for global awareness and informed decision-making.
          </p>
        </section>

        <section className="modal-section">
          <h3>Key Features</h3>
          <ul>
            <li>Real-time Crisis Monitoring with Severity Classification</li>
            <li>Interactive Global Map Visualization</li>
            <li>Automated Data Collection and Processing</li>
            <li>Priority-based Information Display</li>
            <li>Responsive Design with Modern UI/UX</li>
            <li>Intelligent Crisis Clustering and Deduplication</li>
          </ul>
        </section>

        <section className="modal-section">
          <h3>About the Developer</h3>
          <p>
            <strong>Ishan Srivastava</strong><br />
            First-year engineering student at IIT with a passion for product development and problem-solving. 
            Always excited about turning innovative ideas into impactful solutions.
          </p>
          <p>
            <a href="https://github.com/ISHAN-py" target="_blank" rel="noopener noreferrer" className="github-link">
              <svg height="20" width="20" viewBox="0 0 16 16" className="github-icon">
                <path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
              </svg>
              Visit my GitHub
            </a>
          </p>
        </section>
      </div>
    </div>
  );
};

export default AboutModal;