// App.jsx - Tam ve güncel versiyon

import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import './App.css';

const App = () => {
  const [currentPage, setCurrentPage] = useState('home');
  
  const [cameras, setCameras] = useState([
    { id: 0, name: 'KUZEY KAVŞAĞI', fps: 0, vehicles: 0, lightStatus: 'KIRMIZI', lightTimer: 0, image: null },
    { id: 1, name: 'GÜNEY KAVŞAĞI', fps: 0, vehicles: 0, lightStatus: 'KIRMIZI', lightTimer: 0, image: null },
    { id: 2, name: 'DOĞU KAVŞAĞI', fps: 0, vehicles: 0, lightStatus: 'KIRMIZI', lightTimer: 0, image: null }
  ]);

  const [systemMetrics, setSystemMetrics] = useState({
    activeVehicles: 0,
    algorithmStatus: 'ACTIVE',
    avgWaitTime: 0,
    throughput: 0
  });

  const [logs, setLogs] = useState([
    { id: 1, time: new Date().toLocaleTimeString('tr-TR'), level: 'INFO', msg: 'Sistem başlatılıyor...' }
  ]);

  const [currentTime, setCurrentTime] = useState(new Date());
  const [isConnected, setIsConnected] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [animatedStats, setAnimatedStats] = useState({
    uptime: 0,
    efficiency: 0,
    monitoring: 0
  });
  
  const socketRef = useRef(null);
  const notificationRef = useRef(null);
  const statsRef = useRef(null);
  const statsAnimationStarted = useRef(false);

  useEffect(() => {
    if (currentPage === 'about' && !statsAnimationStarted.current) {
      statsAnimationStarted.current = true;
      
      const duration = 3000;
      const steps = 100;
      const interval = duration / steps;
      
      let currentStep = 0;
      
      const timer = setInterval(() => {
        currentStep++;
        const progress = currentStep / steps;
        const easedProgress = 1 - Math.pow(1 - progress, 3);
        
        setAnimatedStats({
          uptime: Math.min(99.9, easedProgress * 99.9),
          efficiency: Math.min(45, easedProgress * 45),
          monitoring: Math.min(100, easedProgress * 100)
        });
        
        if (currentStep >= steps) {
          clearInterval(timer);
          setAnimatedStats({
            uptime: 99.9,
            efficiency: 45,
            monitoring: 100
          });
        }
      }, interval);
      
      return () => clearInterval(timer);
    }
  }, [currentPage]);

  useEffect(() => {
    if (currentPage !== 'about') {
      statsAnimationStarted.current = false;
      setAnimatedStats({ uptime: 0, efficiency: 0, monitoring: 0 });
    }
  }, [currentPage]);

  const addLog = (level, msg) => {
    const newLog = {
      id: Date.now(),
      time: new Date().toLocaleTimeString('tr-TR'),
      level: level,
      msg: msg
    };
    setLogs(prev => [newLog, ...prev].slice(0, 50));
    setNotificationCount(prev => prev + 1);
  };

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
    const socketUrl = `${protocol}//localhost:5000`;
    
    socketRef.current = io(socketUrl, {
      transports: ['websocket', 'polling']
    });
    
    socketRef.current.on('connect', () => {
      console.log('✅ Backend bağlantısı kuruldu');
      setIsConnected(true);
      addLog('OK', 'Backend sunucusuna bağlanıldı');
      
      const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
      const apiUrl = `${protocol}//localhost:5000/api/videos`;
      
      fetch(apiUrl)
        .then(res => res.json())
        .then(videos => {
          console.log('📹 Backend videolar:', videos);
          if (videos.length > 0) {
            addLog('OK', `${videos.length} video backend'den yüklendi`);
          }
        })
        .catch(err => {
          console.error('Video bilgisi alınamadı:', err);
          addLog('WARN', 'Backend videolar alınamadı');
        });
    });
    
    socketRef.current.on('disconnect', () => {
      setIsConnected(false);
      addLog('WARN', 'Backend bağlantısı kesildi');
    });
    
    socketRef.current.on('camera_update', (data) => {
      setCameras(prev => prev.map(cam => 
        cam.id === data.camera_id ? {
          ...cam,
          vehicles: data.vehicles,
          lightStatus: data.light_status,
          lightTimer: data.light_timer,
          fps: data.label,
          image: `data:image/jpeg;base64,${data.image}`
        } : cam
      ));
    });
    
    socketRef.current.on('system_update', (data) => {
      setSystemMetrics({
        activeVehicles: data.active_vehicles,
        algorithmStatus: data.algorithm_status,
        avgWaitTime: data.avg_wait_time,
        throughput: data.throughput
      });
    });

    socketRef.current.on('upload_success', (data) => {
      addLog('OK', `Video yüklendi: ${data.filename} (${data.message})`);
    });

    socketRef.current.on('initial_videos', (data) => {
      if (data.videos && data.videos.length > 0) {
        addLog('OK', `${data.videos.length} video başlatıldı`);
      }
    });

    const handleClickOutside = (event) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
      socketRef.current.disconnect();
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleManualOverride = (cameraId) => {
    if (socketRef.current) {
      socketRef.current.emit('manual_override', { camera_id: cameraId });
      addLog('OK', `Manuel müdahale: Kamera ${cameraId + 1}`);
    }
  };

  const handleStartSystem = () => {
    if (isStarting) return;
    setIsStarting(true);
    if (socketRef.current) {
      socketRef.current.emit('start_system');
      addLog('OK', 'Sistem başlatıldı');
    }
    setTimeout(() => setIsStarting(false), 2500);
  };

  const getLogClass = (level) => {
    switch(level) {
      case 'ERROR': return 'log-error';
      case 'WARN': return 'log-warn';
      case 'OK': return 'log-ok';
      default: return 'log-info';
    }
  };

  const teamMembers = [
    { name: 'Sedat Eroğlu', role: 'Front End ve Yapay Zeka', avatar: '👨‍💻', color: '#3b82f6' },
    { name: 'Berk Altınöz', role: 'Back End ve Yapay Zeka', avatar: '👨‍💼', color: '#8b5cf6' }
  ];

  const renderHomePage = () => (
    <div className="main-content">
      <div className="camera-grid-new">
        <div className="cameras-vertical">
          {cameras.map((cam) => (
            <div key={cam.id} className="camera-card" onClick={() => handleManualOverride(cam.id)}>
              <div className="camera-feed">
                {cam.image ? (
                  <img 
                    src={cam.image} 
                    alt={cam.name} 
                    className="video-feed"
                    width="320"
                    height="240"
                  />
                ) : (
                  <div className="video-placeholder">
                    <div className="scan-line"></div>
                    <div className="loading-text">
                      <span className="loading-dot">●</span> Yükleniyor...
                    </div>
                  </div>
                )}
                <div className="hud-top-left">
                  <div className="hud-item fps">🎥 {cam.fps} FPS</div>
                  <div className="hud-item vehicles">🚗 {cam.vehicles} araç</div>
                  <div className="hud-item timer">⏱️ {cam.lightTimer} sn</div>
                </div>
                <div className="camera-name-bottom">{cam.name}</div>
                <div className="camera-status-indicator">
                  <span className={`status-light ${cam.lightStatus === 'YEŞİL' ? 'green' : cam.lightStatus === 'SARI' ? 'yellow' : 'red'}`}></span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="control-panel">
        <div className="panel-header">
          <h2>AKILLI KAVŞAK MERKEZİ</h2>
          <div className="panel-status">
            <span className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`}></span>
          </div>
        </div>

        <div className="metrics-container">
          <div className="metric-card">
            <div className="metric-icon-wrapper blue">
              <span className="metric-icon">🚗</span>
            </div>
            <div className="metric-info">
              <div className="metric-title">AKTİF ARAÇLAR</div>
              <div className="metric-value">{systemMetrics.activeVehicles}</div>
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-icon-wrapper purple">
              <span className="metric-icon">🧠</span>
            </div>
            <div className="metric-info">
              <div className="metric-title">ALGORİTMA DURUMU</div>
              <div className="metric-value">{systemMetrics.algorithmStatus}</div>
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-icon-wrapper orange">
              <span className="metric-icon">⏱️</span>
            </div>
            <div className="metric-info">
              <div className="metric-title">ORTALAMA BEKLEME</div>
              <div className="metric-value">{systemMetrics.avgWaitTime} sn</div>
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-icon-wrapper green">
              <span className="metric-icon">📈</span>
            </div>
            <div className="metric-info">
              <div className="metric-title">SAATLİK AKIŞ</div>
              <div className="metric-value">{systemMetrics.throughput}</div>
            </div>
          </div>
        </div>

        {/* Buton üstüne eklenen sistem bilgi çubuğu */}
        <div className="system-info-bar">
          <div className="info-item">
            <span className="info-label">SİSTEM DURUMU</span>
            <span className="info-value online">ÇEVRİMİÇİ</span>
          </div>
          <div className="info-divider"></div>
          <div className="info-item">
            <span className="info-label">AKTİF KAMERA</span>
            <span className="info-value">3/3</span>
          </div>
          <div className="info-divider"></div>
          <div className="info-item">
            <span className="info-label">GÜNCELLEME</span>
            <span className="info-value">CANLI</span>
          </div>
        </div>

        <div className="action-buttons">
          <button 
            className={`start-btn-pro ${isStarting ? 'starting' : ''}`}
            onClick={handleStartSystem}
            disabled={isStarting}
          >
            <div className="btn-content-pro">
              <div className="btn-icon-container">
                <div className="btn-icon-outer">
                  <div className="btn-icon-inner">
                    {isStarting ? (
                      <div className="spinner-mini"></div>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="5 3 19 12 5 21 5 3"></polygon>
                      </svg>
                    )}
                  </div>
                </div>
              </div>
              <div className="btn-text-container">
                <span className="btn-main-text">
                  {isStarting ? 'BAŞLATILIYOR' : 'SİSTEMİ BAŞLAT'}
                </span>
                <span className="btn-sub-text">
                  {isStarting ? 'Sistem aktive ediliyor...' : 'Tüm kameraları etkinleştir'}
                </span>
              </div>
              <div className="btn-arrow-pro">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );

  const renderAboutPage = () => (
    <div className="about-page">
      <div className="about-hero">
        <div className="about-hero-bg">
          <div className="hero-grid"></div>
          <div className="hero-orb orb-1"></div>
          <div className="hero-orb orb-2"></div>
          <div className="hero-orb orb-3"></div>
        </div>
        <div className="about-hero-content">
          <div className="hero-atom-animation">
            <div className="hero-atom">
              <div className="hero-nucleus"></div>
              <div className="hero-orbit hero-orbit-1">
                <div className="hero-electron"></div>
              </div>
              <div className="hero-orbit hero-orbit-2">
                <div className="hero-electron"></div>
              </div>
              <div className="hero-orbit hero-orbit-3">
                <div className="hero-electron"></div>
              </div>
            </div>
          </div>
          <h1 className="about-title animate-fade-in">
            ATOM Hakkında
          </h1>
          <p className="about-subtitle animate-slide-up">
            Akıllı Trafik Optimizasyon Merkezi - Yapay Zeka Destekli Trafik Yönetim Sistemi
          </p>
          <div className="hero-stats-mini" ref={statsRef}>
            <div className="hero-stat-mini animate-stat stagger-1">
              <div className="stat-number-wrapper">
                <span className="hero-stat-number">
                  {animatedStats.uptime.toFixed(1)}%
                </span>
                <div className="stat-progress-ring">
                  <svg viewBox="0 0 100 100">
                    <circle className="ring-bg" cx="50" cy="50" r="45"></circle>
                    <circle 
                      className="ring-progress" 
                      cx="50" cy="50" r="45"
                      style={{ strokeDashoffset: 283 - (283 * animatedStats.uptime) / 100 }}
                    ></circle>
                  </svg>
                </div>
              </div>
              <span className="hero-stat-label">Çalışma Süresi</span>
            </div>
            <div className="hero-stat-mini animate-stat stagger-2">
              <div className="stat-number-wrapper">
                <span className="hero-stat-number">
                  {Math.round(animatedStats.efficiency)}%
                </span>
                <div className="stat-progress-ring">
                  <svg viewBox="0 0 100 100">
                    <circle className="ring-bg" cx="50" cy="50" r="45"></circle>
                    <circle 
                      className="ring-progress" 
                      cx="50" cy="50" r="45"
                      style={{ strokeDashoffset: 283 - (283 * animatedStats.efficiency) / 100 }}
                    ></circle>
                  </svg>
                </div>
              </div>
              <span className="hero-stat-label">Verimlilik Artışı</span>
            </div>
            <div className="hero-stat-mini animate-stat stagger-3">
              <div className="stat-number-wrapper">
                <span className="hero-stat-number">24/7</span>
                <div className="stat-progress-ring">
                  <svg viewBox="0 0 100 100">
                    <circle className="ring-bg" cx="50" cy="50" r="45"></circle>
                    <circle 
                      className="ring-progress active" 
                      cx="50" cy="50" r="45"
                    ></circle>
                  </svg>
                </div>
              </div>
              <span className="hero-stat-label">Kesintisiz İzleme</span>
            </div>
          </div>
        </div>
      </div>

      <div className="about-content">
        <div className="about-mission animate-on-scroll">
          <div className="mission-icon-wrapper">
            <div className="mission-icon">🎯</div>
            <div className="mission-icon-glow"></div>
          </div>
          <h2>Misyonumuz</h2>
          <p>
            ATOM (Akıllı Trafik Optimizasyon Merkezi), şehir içi trafik akışını optimize etmek için 
            gelişmiş yapay zeka algoritmaları kullanan yenilikçi bir platformdur. Gerçek zamanlı 
            kamera verilerini işleyerek trafik ışıklarını dinamik olarak yönetir, bekleme sürelerini 
            minimize eder ve karbon emisyonlarını azaltır.
          </p>
        </div>

        <div className="about-features">
          <div className="feature-card animate-on-scroll">
            <div className="feature-icon-wrapper">
              <div className="feature-icon">🧠</div>
              <div className="feature-icon-bg"></div>
            </div>
            <h3>Yapay Zeka</h3>
            <p>Deep learning algoritmaları ile anlık trafik analizi</p>
            <div className="feature-line"></div>
          </div>
          <div className="feature-card animate-on-scroll">
            <div className="feature-icon-wrapper">
              <div className="feature-icon">📹</div>
              <div className="feature-icon-bg"></div>
            </div>
            <h3>Gerçek Zamanlı İzleme</h3>
            <p>4K kameralarla 7/24 kavşak takibi</p>
            <div className="feature-line"></div>
          </div>
          <div className="feature-card animate-on-scroll">
            <div className="feature-icon-wrapper">
              <div className="feature-icon">⚡</div>
              <div className="feature-icon-bg"></div>
            </div>
            <h3>Dinamik Optimizasyon</h3>
            <p>Trafik yoğunluğuna göre anlık ışık süresi ayarı</p>
            <div className="feature-line"></div>
          </div>
          <div className="feature-card animate-on-scroll">
            <div className="feature-icon-wrapper">
              <div className="feature-icon">📊</div>
              <div className="feature-icon-bg"></div>
            </div>
            <h3>Veri Analitiği</h3>
            <p>Kapsamlı raporlama ve tahminleme sistemleri</p>
            <div className="feature-line"></div>
          </div>
        </div>

        <div className="about-team">
          <h2 className="section-title">
            <span className="title-line"></span>
            Ekibimiz
            <span className="title-line"></span>
          </h2>
          <div className="team-grid">
            {teamMembers.map((member, index) => (
              <div key={index} className="team-card animate-on-scroll">
                <div className="team-card-inner">
                  <div className="team-avatar-wrapper" style={{'--avatar-color': member.color}}>
                    <div className="team-avatar-bg"></div>
                    <div className="team-avatar">{member.avatar}</div>
                  </div>
                  <h3>{member.name}</h3>
                  <p className="team-role">{member.role}</p>
                  <div className="team-skills">
                    <span className="skill-badge">AI</span>
                    <span className="skill-badge">ML</span>
                    <span className="skill-badge">React</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderServicesPage = () => (
    <div className="services-page">
      <div className="services-hero">
        <div className="services-hero-bg">
          <div className="services-grid-pattern"></div>
          <div className="services-floating-shapes">
            <div className="floating-shape shape-1"></div>
            <div className="floating-shape shape-2"></div>
            <div className="floating-shape shape-3"></div>
            <div className="floating-shape shape-4"></div>
            <div className="floating-shape shape-5"></div>
            <div className="floating-shape shape-6"></div>
          </div>
          <div className="hero-particles-container">
            {[...Array(20)].map((_, i) => (
              <div key={i} className={`hero-particle particle-${i}`}></div>
            ))}
          </div>
        </div>
        <div className="services-hero-content">
          <div className="title-decoration">
            <div className="decoration-line"></div>
            <div className="decoration-dot"></div>
            <div className="decoration-line"></div>
          </div>
          <h1 className="services-title">
            <span className="title-word word-1">Hizmetler</span>
          </h1>
          <p className="services-subtitle">
            <span className="subtitle-text">Akıllı şehirler için entegre trafik çözümleri</span>
            <span className="subtitle-underline"></span>
          </p>
        </div>
      </div>
      
      <div className="services-grid">
        <div className="service-card animate-on-scroll">
          <div className="service-card-glow"></div>
          <div className="service-icon-wrapper">
            <div className="service-icon-circle">
              <span className="service-icon">🚦</span>
            </div>
          </div>
          <h2>Akıllı Kavşak Yönetimi</h2>
          <p>Yapay zeka destekli gerçek zamanlı trafik ışığı optimizasyonu ile kavşaklarda bekleme sürelerini %45'e varan oranda azaltın.</p>
          <ul className="service-features">
            <li><span className="check-icon">✦</span> Adaptif ışık süreleri</li>
            <li><span className="check-icon">✦</span> Gerçek zamanlı trafik optimizasyonu</li>
            <li><span className="check-icon">✦</span> Normal sinyalizasyon modu</li>
          </ul>
        </div>
        
        <div className="service-card animate-on-scroll">
          <div className="service-card-glow"></div>
          <div className="service-icon-wrapper">
            <div className="service-icon-circle">
              <span className="service-icon">📹</span>
            </div>
          </div>
          <h2>Video Analitik</h2>
          <p>Gelişmiş görüntü işleme ile araç sayımı, plaka tanıma ve trafik ihlali tespiti gerçekleştirin.</p>
          <ul className="service-features">
            <li><span className="check-icon">✦</span> Gerçek zamanlı araç sayımı</li>
            <li><span className="check-icon">✦</span> Anomali tespiti</li>
            <li><span className="check-icon">✦</span> Video analiz sistemi</li>
          </ul>
        </div>
        
        <div className="service-card animate-on-scroll">
          <div className="service-card-glow"></div>
          <div className="service-icon-wrapper">
            <div className="service-icon-circle">
              <span className="service-icon">📊</span>
            </div>
          </div>
          <h2>Trafik Analitiği</h2>
          <p>Trafik verilerine göre,trafik ışıklarını ve süresini optimize edin.</p>
          <ul className="service-features">
            <li><span className="check-icon">✦</span> Süre optimizasyonu</li>
            <li><span className="check-icon">✦</span> Analiz araçları</li>
            <li><span className="check-icon">✦</span> Analitik raporlar</li>
          </ul>
        </div>
        
        <div className="service-card animate-on-scroll">
          <div className="service-card-glow"></div>
          <div className="service-icon-wrapper">
            <div className="service-icon-circle">
              <span className="service-icon">🔗</span>
            </div>
          </div>
          <h2>Entegrasyon Çözümleri</h2>
          <p>Mevcut altyapınızla sorunsuz entegrasyon ve sistemlerle uyumluluk.</p>
          <ul className="service-features">
            <li><span className="check-icon">✦</span> Prototip desteği</li>
            <li><span className="check-icon">✦</span> Arduino entegrasyonu</li>
            <li><span className="check-icon">✦</span> Web entegrasyonu</li>
          </ul>
        </div>
      </div>
    </div>
  );

  const renderCurrentPage = () => {
    switch(currentPage) {
      case 'home':
        return renderHomePage();
      case 'about':
        return renderAboutPage();
      case 'services':
        return renderServicesPage();
      default:
        return renderHomePage();
    }
  };

  return (
    <div className="dashboard">
      <nav className="top-menu">
        <div className="menu-left">
          <div className="logo-container">
            <div className="atom-logo">
              <div className="atom-nucleus"></div>
              <div className="atom-orbit orbit-1"></div>
              <div className="atom-orbit orbit-2"></div>
              <div className="atom-orbit orbit-3"></div>
            </div>
            <div className="logo-texts">
              <span className="logo-main">ATOM</span>
              <span className="logo-sub">Akıllı Trafik Optimizasyon Merkezi</span>
            </div>
          </div>
          
          <div className="nav-links">
            <button 
              className={`nav-link-pro ${currentPage === 'home' ? 'active' : ''}`}
              onClick={() => setCurrentPage('home')}
            >
              <span className="nav-icon-pro">◆</span>
              <span className="nav-text">Anasayfa</span>
              <span className="nav-hover-line"></span>
            </button>
            <button 
              className={`nav-link-pro ${currentPage === 'about' ? 'active' : ''}`}
              onClick={() => setCurrentPage('about')}
            >
              <span className="nav-icon-pro">◆</span>
              <span className="nav-text">Hakkımızda</span>
              <span className="nav-hover-line"></span>
            </button>
            <button 
              className={`nav-link-pro ${currentPage === 'services' ? 'active' : ''}`}
              onClick={() => setCurrentPage('services')}
            >
              <span className="nav-icon-pro">◆</span>
              <span className="nav-text">Hizmetler</span>
              <span className="nav-hover-line"></span>
            </button>
          </div>
        </div>
        
        <div className="menu-right">
          {/* Üst menüye eklenen sistem durum göstergesi */}
          <div className="system-status-badge">
            <div className="status-led"></div>
            <span className="status-text-header">SİSTEM AKTİF</span>
          </div>
          
          <div className="menu-divider"></div>
          
          <div className="menu-time">
            <span className="time-icon">🕐</span>
            {currentTime.toLocaleTimeString('tr-TR')}
          </div>
          
          <div className="menu-notification" ref={notificationRef}>
            <button 
              className="notification-btn"
              onClick={() => {
                setShowNotifications(!showNotifications);
                if (!showNotifications) {
                  setNotificationCount(0);
                }
              }}
            >
              <span className="notif-icon">🔔</span>
              {notificationCount > 0 && (
                <span className="notif-count">{notificationCount}</span>
              )}
            </button>
            
            {showNotifications && (
              <div className="notification-dropdown">
                <div className="notification-header">
                  <h3>Bildirimler</h3>
                  <span className="notification-count-badge">{logs.length} olay</span>
                </div>
                <div className="notification-list">
                  {logs.slice(0, 10).map(log => (
                    <div key={log.id} className={`notification-item ${getLogClass(log.level)}`}>
                      <span className="notification-time">[{log.time}]</span>
                      <span className="notification-level">[{log.level}]</span>
                      <span className="notification-msg">{log.msg}</span>
                    </div>
                  ))}
                  {logs.length === 0 && (
                    <div className="notification-empty">
                      <p>Bildirim bulunmuyor</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          
          <div className="menu-status">
            <span className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`}></span>
          </div>
        </div>
      </nav>

      {renderCurrentPage()}

      <footer className="main-footer">
        <div className="footer-content">
          <div className="footer-section">
            <div className="footer-logo">
              <div className="atom-logo-small">
                <div className="atom-nucleus-small"></div>
                <div className="atom-orbit-small"></div>
              </div>
              <span className="footer-brand">ATOM</span>
            </div>
            <p className="footer-description">
              Akıllı Trafik Optimizasyon Merkezi, yapay zeka teknolojileri ile şehirlerin trafik sorunlarına yenilikçi çözümler sunar.
            </p>
            <div className="footer-social">
              <a href="#" className="social-link">
                <span className="social-icon">🔵</span>
              </a>
              <a href="#" className="social-link">
                <span className="social-icon">🐦</span>
              </a>
              <a href="#" className="social-link">
                <span className="social-icon">📷</span>
              </a>
              <a href="#" className="social-link">
                <span className="social-icon">💼</span>
              </a>
            </div>
          </div>
        </div>
        
        <div className="footer-bottom">
          <div className="footer-bottom-content">
            <p>&copy; 2024 ATOM - Akıllı Trafik Optimizasyon Merkezi. Tüm hakları saklıdır.</p>
            <div className="footer-bottom-links">
              <a href="#">Gizlilik Politikası</a>
              <a href="#">Kullanım Koşulları</a>
              <a href="#">KVKK</a>
              <a href="#">Çerez Politikası</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;