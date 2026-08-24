import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { createClient } from "@supabase/supabase-js";
import {
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Eye,
  EyeOff,
  Folder,
  FolderPlus,
  Heart,
  ImagePlus,
  Lock,
  LogOut,
  Mail,
  MoreHorizontal,
  Palette,
  Play,
  Plus,
  Settings,
  ShieldCheck,
  Trash2,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import "./style.css";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase =
  supabaseUrl && supabaseKey && supabaseUrl.includes(".supabase.co")
    ? createClient(supabaseUrl, supabaseKey)
    : null;
const appUrl = (import.meta.env.VITE_APP_URL || window.location.origin).replace(
  /\/$/,
  "",
);
const backgrounds = [
  "#F4E4DC",
  "#E3EEDF",
  "#E3EDF3",
  "#F2E7CF",
  "#EBE1EE",
  "#DCE9E6",
  "#F1E3DC",
  "#E8ECD5",
  "#E4E2F3",
  "#F1DFDF",
  "#DCE7F0",
  "#EEE7D9",
];
const exampleImages = [
  "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1000&q=80",
  "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1000&q=80",
  "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1000&q=80",
  "https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=1000&q=80",
];

const score = (password) =>
  [
    password.length >= 8,
    /[A-ZА-Я]/.test(password),
    /\d/.test(password),
    /[^A-Za-zА-Яа-я0-9]/.test(password),
  ].filter(Boolean).length;
function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function PasswordField({
  label = "Пароль",
  value,
  onChange,
  placeholder = "Минимум 6 символов",
  autoFocus = false,
  minLength = 6,
}) {
  const [visible, setVisible] = useState(false);
  return (
    <Field label={label}>
      <span className="password-input">
        <input
          required
          autoFocus={autoFocus}
          minLength={minLength}
          type={visible ? "text" : "password"}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
        />
        <button
          type="button"
          className="password-toggle"
          aria-label={visible ? "Скрыть пароль" : "Показать пароль"}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? <EyeOff size={19} /> : <Eye size={19} />}
        </button>
      </span>
    </Field>
  );
}
function Logo() {
  return (
    <div className="logo">
      <span>
        <Heart size={16} fill="currentColor" />
      </span>{" "}
      альбом<b>.com</b>
    </div>
  );
}
function messageFrom(error) {
  if (error?.message?.toLowerCase().includes("rate limit"))
    return "Слишком много писем за короткое время. Подождите несколько минут. Для реального сайта подключите SMTP — инструкция есть в README.";
  return error?.message || "Не удалось выполнить действие. Попробуйте ещё раз.";
}

function App() {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(!supabase);
  const [profile, setProfile] = useState(null);
  const [albums, setAlbums] = useState([]);
  const [active, setActive] = useState(null);
  const [page, setPage] = useState("home");
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState(null);
  const slug = window.location.pathname.match(/^\/a\/([^/]+)$/)?.[1];
  const notify = (text, type = "error") => setToast({ text, type });

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) =>
      setSession(next),
    );
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!session) {
      setProfile(null);
      setAlbums([]);
      setActive(null);
      setPage("home");
      return;
    }
    const load = async () => {
      const user = session.user;
      const [{ data: userProfile }, { data, error }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        supabase
          .from("albums")
          .select(
            "id,title,slug,background,created_at,album_folders(id),media(id)",
          )
          .eq("owner_id", user.id)
          .order("created_at", { ascending: false }),
      ]);
      if (error) notify(messageFrom(error));
      setProfile(
        userProfile || {
          display_name: user.user_metadata.full_name || "",
          avatar_path: null,
        },
      );
      setAlbums(data || []);
      setActive((current) =>
        current?.owner_id === user.id ? current : data?.[0] || null,
      );
    };
    load();
  }, [session]);
  useEffect(() => {
    if (!session) return;
    const pending = sessionStorage.getItem("album-invite");
    if (!pending) return;
    const { password, sharedSlug } = JSON.parse(pending);
    supabase
      .rpc("unlock_album", { album_slug: sharedSlug, album_password: password })
      .then(({ data, error }) => {
        if (error) notify(messageFrom(error));
        else {
          setActive(data);
          sessionStorage.removeItem("album-invite");
          window.history.replaceState({}, "", "/");
          setPage("home");
        }
      });
  }, [session]);

  if (!supabase) return <Setup />;
  if (!ready)
    return (
      <main className="loading">
        <Logo />
        <span>Открываем воспоминания…</span>
      </main>
    );
  if (window.location.pathname === "/reset-password")
    return <Auth initial="new-password" />;
  if (slug) return <Invite slug={slug} />;
  if (!session) return <Auth />;
  const user = session.user;
  return (
    <div className="app">
      <Header
        user={user}
        profile={profile}
        onHome={() => setPage("home")}
        onProfile={() => setPage("profile")}
      />
      {toast && <Toast {...toast} close={() => setToast(null)} />}{" "}
      {page === "home" ? (
        <AlbumPage
          album={active}
          user={user}
          openCreate={() => setModal("create-album")}
          openFolder={(folder) => setModal({ type: "folder", folder })}
          openUpload={() => setModal({ type: "upload", folder: null })}
          openFolderCreate={() => setModal("create-folder")}
          openProfile={() => setPage("profile")}
          openEditAlbum={() => setModal("edit-album")}
        />
      ) : (
        <Dashboard
          user={user}
          profile={profile}
          albums={albums}
          openHome={() => setPage("home")}
          choose={(album) => {
            setActive(album);
            setPage("home");
          }}
          create={() => setModal("create-album")}
          settings={() => setModal("settings")}
        />
      )}
      {modal && (
        <Modal close={() => setModal(null)}>
          {modal === "create-album" && (
            <CreateAlbum
              done={(album) => {
                setAlbums((old) => [album, ...old]);
                setActive(album);
                setModal({ type: "share", album });
              }}
              notify={notify}
            />
          )}{" "}
          {modal?.type === "share" && (
            <Share album={modal.album} close={() => setModal(null)} />
          )}{" "}
          {modal?.type === "folder" && (
            <FolderModal
              folder={modal.folder}
              album={active}
              user={user}
              notify={notify}
            />
          )}{" "}
          {modal?.type === "upload" && (
            <UploadModal
              album={active}
              folder={modal.folder}
              user={user}
              notify={notify}
            />
          )}{" "}
          {modal === "create-folder" && (
            <CreateFolder
              album={active}
              notify={notify}
              close={() => setModal(null)}
            />
          )}{" "}
          {modal === "settings" && (
            <SettingsModal
              user={user}
              profile={profile}
              notify={notify}
              close={() => setModal(null)}
            />
          )}{" "}
          {modal === "edit-album" && active && (
            <EditAlbumModal
              album={active}
              user={user}
              notify={notify}
              close={() => setModal(null)}
              onAlbumDeleted={() => {
                setModal(null);
                setActive(null);
                setPage("profile");
                // Перезагружаем список альбомов
                supabase
                  .from("albums")
                  .select(
                    "id,title,slug,background,created_at,album_folders(id),media(id)",
                  )
                  .eq("owner_id", user.id)
                  .order("created_at", { ascending: false })
                  .then(({ data }) => setAlbums(data || []));
              }}
            />
          )}
        </Modal>
      )}
    </div>
  );
}

function Setup() {
  return (
    <main className="auth-layout">
      <section className="auth-box">
        <Logo />
        <p className="eyebrow">ПЕРВЫЙ ЗАПУСК</p>
        <h1>Подключите Supabase</h1>
        <p>
          Добавьте адрес проекта и публичный ключ в файл <code>.env</code>,
          затем перезапустите сайт.
        </p>
        <pre>
          VITE_SUPABASE_URL=https://xxxx.supabase.co{`\n`}
          VITE_SUPABASE_ANON_KEY=ваш_публичный_ключ
        </pre>
      </section>
    </main>
  );
}
function Header({ user, profile, onHome, onProfile }) {
  const initial = (profile?.display_name || user.email)
    .slice(0, 1)
    .toUpperCase();
  return (
    <header>
      <button onClick={onHome}>
        <Logo />
      </button>
      <div className="header-actions">
        <span className="mail">
          <Mail size={15} />
          {user.email}
          <i>Проверен</i>
        </span>
        <button className="avatar" onClick={onProfile}>
          {profile?.avatar_path ? (
            <SignedAvatar path={profile.avatar_path} />
          ) : (
            initial
          )}
        </button>
      </div>
    </header>
  );
}

function Auth({ initial = "login" }) {
  const [mode, setMode] = useState(initial),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [status, setStatus] = useState(null),
    [busy, setBusy] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setStatus(null);
    let error;
    if (mode === "login")
      ({ error } = await supabase.auth.signInWithPassword({ email, password }));
    if (mode === "signup")
      ({ error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: appUrl },
      }));
    if (mode === "reset")
      ({ error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${appUrl}/reset-password`,
      }));
    if (mode === "new-password")
      ({ error } = await supabase.auth.updateUser({ password }));
    setBusy(false);
    if (error) return setStatus({ type: "error", text: messageFrom(error) });
    if (mode === "signup")
      setStatus({
        type: "success",
        text: "Письмо с подтверждением отправлено. Откройте его, затем войдите в аккаунт.",
      });
    if (mode === "reset")
      setStatus({
        type: "success",
        text: "Ссылка для сброса отправлена на почту. Проверьте также папку «Спам».",
      });
    if (mode === "new-password") {
      window.history.replaceState({}, "", "/");
      window.location.reload();
    }
  };
  const titles = {
    login: "С возвращением",
    signup: "Создайте свой альбом",
    reset: "Сброс пароля",
    "new-password": "Новый пароль",
  };
  return (
    <main className="auth-layout">
      <section className="auth-visual">
        <div className="visual-image" />
        <p>
          Храните самые дорогие
          <br />
          <i>моменты вместе.</i>
        </p>
      </section>
      <section className="auth-box">
        <Logo />
        <p className="eyebrow">СЕМЕЙНЫЕ ВОСПОМИНАНИЯ</p>
        <h1>{titles[mode]}</h1>
        <p>
          {mode === "reset"
            ? "Мы отправим стандартную безопасную ссылку для сброса пароля."
            : mode === "new-password"
              ? "Введите и сохраните новый пароль."
              : "Ваше личное пространство для семейных историй."}
        </p>
        <form onSubmit={submit}>
          {mode !== "new-password" && (
            <Field label="Электронная почта">
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </Field>
          )}
          {["login", "signup", "new-password"].includes(mode) && (
            <Field label={mode === "new-password" ? "Новый пароль" : "Пароль"}>
              <input
                required
                minLength="6"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Минимум 6 символов"
              />
            </Field>
          )}
          {status && (
            <p className={`form-message ${status.type}`}>{status.text}</p>
          )}
          <button className="primary" disabled={busy}>
            {busy
              ? "Пожалуйста, подождите…"
              : mode === "login"
                ? "Войти"
                : mode === "signup"
                  ? "Создать аккаунт"
                  : mode === "reset"
                    ? "Отправить ссылку"
                    : "Сохранить пароль"}
          </button>
        </form>
        <div className="auth-links">
          {mode === "login" && (
            <>
              <button onClick={() => setMode("reset")}>Забыли пароль?</button>
              <span>
                Нет аккаунта?{" "}
                <button onClick={() => setMode("signup")}>
                  Зарегистрироваться
                </button>
              </span>
            </>
          )}
          {mode === "signup" && (
            <span>
              Уже есть аккаунт?{" "}
              <button onClick={() => setMode("login")}>Войти</button>
            </span>
          )}
          {mode === "reset" && (
            <button onClick={() => setMode("login")}>Вернуться ко входу</button>
          )}
        </div>
      </section>
    </main>
  );
}
function Invite({ slug }) {
  const [password, setPassword] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.rpc("check_album_password", {
      album_slug: slug,
      album_password: password,
    });
    setBusy(false);
    if (error || !data)
      return setMessage("Пароль неверный или эта ссылка не существует.");
    sessionStorage.setItem(
      "album-invite",
      JSON.stringify({ sharedSlug: slug, password }),
    );
    window.location.href = "/";
  };
  return (
    <main className="auth-layout">
      <section className="auth-box invite">
        <Logo />
        <p className="eyebrow">ВАС ПРИГЛАСИЛИ</p>
        <h1>Семейный альбом</h1>
        <p>
          Этот альбом защищён. Введите пароль, после чего войдите или
          зарегистрируйтесь.
        </p>
        <form onSubmit={submit}>
          <PasswordField
            label="Пароль альбома"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            placeholder="Введите пароль"
            minLength={1}
          />
          {message && <p className="form-message error">{message}</p>}
          <button className="primary" disabled={busy}>
            <Lock size={16} />
            {busy ? "Проверяем…" : "Продолжить"}
          </button>
        </form>
      </section>
    </main>
  );
}

function AlbumPage({
  album,
  user,
  openCreate,
  openFolder,
  openUpload,
  openFolderCreate,
  openProfile,
  openEditAlbum,
}) {
  const [folders, setFolders] = useState([]);
  const [media, setMedia] = useState([]);
  const [allPhotos, setAllPhotos] = useState([]);
  const [viewerMedia, setViewerMedia] = useState(null);
  const slideshowRef = useRef(null);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    if (!album) return;
    
    // Проверяем, является ли пользователь владельцем
    supabase
      .from("albums")
      .select("owner_id")
      .eq("id", album.id)
      .single()
      .then(({ data }) => {
        setIsOwner(data?.owner_id === user.id);
      });

    // Загружаем папки и медиа без папок
    Promise.all([
      supabase
        .from("album_folders")
        .select("*")
        .eq("album_id", album.id)
        .order("created_at"),
      supabase
        .from("media")
        .select("*")
        .eq("album_id", album.id)
        .is("folder_id", null)
        .order("created_at", { ascending: false }),
    ]).then(([folderResult, mediaResult]) => {
      setFolders(folderResult.data || []);
      setMedia(mediaResult.data || []);
    });

    // Загружаем ВСЕ фотографии альбома для слайдшоу (включая из папок)
    supabase
      .from("media")
      .select("*")
      .eq("album_id", album.id)
      .eq("media_type", "image")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setAllPhotos(data || []);
      });
  }, [album, user.id]);

  // Авто-скролл слайдшоу
  useEffect(() => {
    if (!slideshowRef.current || allPhotos.length === 0) return;
    
    const container = slideshowRef.current;
    let scrollPosition = 0;
    const scrollSpeed = 0.5; // пикселей за кадр

    const animate = () => {
      scrollPosition += scrollSpeed;
      if (scrollPosition >= container.scrollWidth / 2) {
        scrollPosition = 0;
      }
      container.scrollLeft = scrollPosition;
    };

    const interval = setInterval(animate, 30);
    return () => clearInterval(interval);
  }, [allPhotos]);

  const handleMediaClick = (item) => {
    setViewerMedia(item);
  };

  const handleMediaDelete = (deletedId) => {
    setMedia((prev) => prev.filter((m) => m.id !== deletedId));
    setAllPhotos((prev) => prev.filter((m) => m.id !== deletedId));
  };

  return (
    <>
      {!album ? (
        <EmptyStart create={openCreate} />
      ) : (
        <>
          <section
            className="album-hero"
            style={{
              background: album.background?.startsWith("#")
                ? album.background
                : `url(${album.background}) center/cover`,
            }}
          >
            <p className="eyebrow">✦ СЕМЕЙНАЯ ИСТОРИЯ ✦</p>
            <h1>{album.title}</h1>
            <p>Место, в котором живут самые тёплые воспоминания.</p>
            
            <div
              className="slideshow"
              ref={slideshowRef}
              style={{
                display: "flex",
                gap: "16px",
                overflowX: "auto",
                scrollBehavior: "smooth",
                paddingBottom: "10px",
              }}
            >
              {allPhotos.length > 0 ? (
                <>
                  {/* Дублируем фото для бесшовного скролла */}
                  {[...allPhotos, ...allPhotos].map((item, index) => (
                    <div
                      key={`${item.id}-${index}`}
                      style={{
                        minWidth: "280px",
                        height: "180px",
                        borderRadius: "8px",
                        overflow: "hidden",
                        cursor: "pointer",
                      }}
                      onClick={() => handleMediaClick(item)}
                    >
                      <SignedImage path={item.file_path} />
                    </div>
                  ))}
                </>
              ) : (
                exampleImages.map((src, index) => (
                  <figure key={src} style={{ minWidth: "280px" }}>
                    <img src={src} alt="Пример фотографии" />
                    <figcaption>Пример</figcaption>
                  </figure>
                ))
              )}
            </div>
          </section>

          <section className="content">
            <div className="section-heading">
              <div>
                <p className="eyebrow">ВСЕ ВОСПОМИНАНИЯ</p>
                <h2>Фотографии и папки</h2>
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                {isOwner && (
                  <button className="secondary" onClick={openEditAlbum}>
                    <Edit2 size={16} />
                    Редактировать альбом
                  </button>
                )}
                <button className="secondary" onClick={openProfile}>
                  Личный кабинет →
                </button>
              </div>
            </div>

            <div className="quick-actions">
              <button onClick={openUpload}>
                <ImagePlus size={18} />
                <span>
                  Добавить
                  <br />
                  <b>фото или видео</b>
                </span>
              </button>
              <button onClick={openFolderCreate}>
                <FolderPlus size={18} />
                <span>
                  Создать
                  <br />
                  <b>новую папку</b>
                </span>
              </button>
            </div>

            {media.length > 0 && (
              <section>
                <h3 className="subheading">Без папки</h3>
                <MediaGrid items={media} onMediaClick={handleMediaClick} />
              </section>
            )}

            {folders.length > 0 && (
              <section>
                <h3 className="subheading">Папки</h3>
                <div className="folder-grid">
                  {folders.map((folder) => (
                    <button
                      className="folder-card"
                      key={folder.id}
                      onClick={() => openFolder(folder)}
                    >
                      <div
                        className="folder-cover"
                        style={{ background: folder.color || "#DCE9E6" }}
                      >
                        <Folder size={42} />
                      </div>
                      <b>{folder.name}</b>
                      <small>Открыть папку</small>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </section>

          {viewerMedia && (
            <MediaViewer
              media={viewerMedia}
              allMedia={media}
              onClose={() => setViewerMedia(null)}
              onDelete={handleMediaDelete}
              isOwner={isOwner}
            />
          )}
        </>
      )}
    </>
  );
}
function EmptyStart({ create }) {
  return (
    <main className="empty-start">
      <div>
        <Logo />
        <p className="eyebrow">ВАШЕ ПРОСТРАНСТВО</p>
        <h1>Начните семейную историю</h1>
        <p>
          Создайте защищённый альбом, загрузите любимые фотографии и поделитесь
          ссылкой только с близкими.
        </p>
        <button className="primary" onClick={create}>
          <Plus size={17} />
          Создать первый альбом
        </button>
      </div>
      <div className="starter-art">
        <img src={exampleImages[2]} alt="Море и скалы" />
        <span>
          Ваши воспоминания
          <br />
          начнутся здесь
        </span>
      </div>
    </main>
  );
}
function MediaGrid({ items, onMediaClick }) {
  return (
    <div className="media-grid">
      {items.map((item) =>
        item.media_type === "image" ? (
          <SignedImage
            key={item.id}
            path={item.file_path}
            onClick={() => onMediaClick?.(item)}
          />
        ) : (
          <SignedVideo
            key={item.id}
            path={item.file_path}
            onClick={() => onMediaClick?.(item)}
          />
        ),
      )}
    </div>
  );
}
function SignedImage({ path, onClick }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    if (path?.startsWith("http")) setSrc(path);
    else
      supabase.storage
        .from("album-media")
        .createSignedUrl(path, 3600)
        .then(({ data }) => setSrc(data?.signedUrl || ""));
  }, [path]);
  return src ? (
    <img
      src={src}
      alt="Воспоминание"
      onClick={onClick}
      style={{ cursor: onClick ? "pointer" : "default" }}
    />
  ) : (
    <div className="image-placeholder" />
  );
}

function SignedVideo({ path, onClick }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    supabase.storage
      .from("album-media")
      .createSignedUrl(path, 3600)
      .then(({ data }) => setSrc(data?.signedUrl || ""));
  }, [path]);
  return (
    <div
      className="video-card"
      onClick={onClick}
      style={{ cursor: "pointer", position: "relative" }}
    >
      {src ? (
        <>
          <video src={src} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              background: "rgba(0,0,0,0.6)",
              borderRadius: "50%",
              padding: "12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Play size={28} color="white" fill="white" />
          </div>
        </>
      ) : (
        <div className="image-placeholder" />
      )}
    </div>
  );
}

function MediaViewer({ media, allMedia, onClose, onDelete, isOwner }) {
  const [currentIndex, setCurrentIndex] = useState(
    allMedia.findIndex((m) => m.id === media.id),
  );
  const [src, setSrc] = useState("");
  const [deleting, setDeleting] = useState(false);

  const currentMedia = allMedia[currentIndex];

  useEffect(() => {
    if (!currentMedia) return;
    supabase.storage
      .from("album-media")
      .createSignedUrl(currentMedia.file_path, 3600)
      .then(({ data }) => setSrc(data?.signedUrl || ""));
  }, [currentMedia]);

  const handleDelete = async () => {
    if (!window.confirm("Удалить это фото или видео?")) return;
    setDeleting(true);
    const { error: storageError } = await supabase.storage
      .from("album-media")
      .remove([currentMedia.file_path]);
    if (storageError) {
      alert("Ошибка удаления файла: " + storageError.message);
      setDeleting(false);
      return;
    }
    const { error } = await supabase
      .from("media")
      .delete()
      .eq("id", currentMedia.id);
    setDeleting(false);
    if (error) {
      alert("Ошибка удаления записи: " + error.message);
      return;
    }
    onDelete(currentMedia.id);
    if (allMedia.length === 1) {
      onClose();
    } else {
      const newIndex = currentIndex >= allMedia.length - 1 ? currentIndex - 1 : currentIndex;
      setCurrentIndex(newIndex);
    }
  };

  const goNext = () => {
    if (currentIndex < allMedia.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [currentIndex, allMedia.length]);

  return (
    <div
      className="media-viewer-backdrop"
      onClick={onClose}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.95)",
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
    >
      <button
        onClick={onClose}
        style={{
          position: "absolute",
          top: "20px",
          right: "20px",
          background: "rgba(255,255,255,0.9)",
          border: "none",
          borderRadius: "50%",
          width: "44px",
          height: "44px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          zIndex: 10001,
        }}
      >
        <X size={24} />
      </button>

      {isOwner && (
        <button
          onClick={handleDelete}
          disabled={deleting}
          style={{
            position: "absolute",
            top: "20px",
            right: "80px",
            background: deleting ? "rgba(150,150,150,0.9)" : "rgba(220,50,50,0.9)",
            color: "white",
            border: "none",
            borderRadius: "8px",
            padding: "12px 20px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            cursor: deleting ? "not-allowed" : "pointer",
            zIndex: 10001,
            fontWeight: "600",
          }}
        >
          <Trash2 size={18} />
          {deleting ? "Удаляем..." : "Удалить"}
        </button>
      )}

      {currentIndex > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            goPrev();
          }}
          style={{
            position: "absolute",
            left: "20px",
            background: "rgba(255,255,255,0.9)",
            border: "none",
            borderRadius: "50%",
            width: "50px",
            height: "50px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            zIndex: 10001,
          }}
        >
          <ChevronLeft size={28} />
        </button>
      )}

      {currentIndex < allMedia.length - 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            goNext();
          }}
          style={{
            position: "absolute",
            right: "20px",
            background: "rgba(255,255,255,0.9)",
            border: "none",
            borderRadius: "50%",
            width: "50px",
            height: "50px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            zIndex: 10001,
          }}
        >
          <ChevronRight size={28} />
        </button>
      )}

      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "90vw",
          maxHeight: "90vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {src &&
          (currentMedia.media_type === "image" ? (
            <img
              src={src}
              alt="Полноэкранный просмотр"
              style={{
                maxWidth: "100%",
                maxHeight: "90vh",
                objectFit: "contain",
                borderRadius: "8px",
              }}
            />
          ) : (
            <video
              src={src}
              controls
              autoPlay
              style={{
                maxWidth: "100%",
                maxHeight: "90vh",
                borderRadius: "8px",
              }}
            />
          ))}
      </div>

      <div
        style={{
          position: "absolute",
          bottom: "30px",
          color: "white",
          fontSize: "14px",
          fontWeight: "600",
        }}
      >
        {currentIndex + 1} / {allMedia.length}
      </div>
    </div>
  );
}


function Dashboard({
  user,
  profile,
  albums,
  openHome,
  choose,
  create,
  settings,
}) {
  const logout = () => supabase.auth.signOut();
  return (
    <main className="dashboard">
      <aside>
        <button className="back" onClick={openHome}>
          ← Вернуться к альбому
        </button>
        <div className="user-card">
          <span className="avatar large">
            {profile?.avatar_path ? (
              <SignedAvatar path={profile.avatar_path} />
            ) : (
              <UserRound size={19} />
            )}
          </span>
          <div>
            <b>{profile?.display_name || "Без имени"}</b>
            <small>{user.email}</small>
          </div>
        </div>
        <nav>
          <button className="active">
            <Heart size={16} />
            Мои альбомы
          </button>
          <button onClick={settings}>
            <Settings size={16} />
            Настройки профиля
          </button>
        </nav>
        <div className="side-bottom">
          <button className="primary" onClick={create}>
            <Plus size={17} />
            Создать альбом
          </button>
          <button className="logout" onClick={logout}>
            <LogOut size={16} />
            Выйти из аккаунта
          </button>
        </div>
      </aside>
      <section className="dashboard-content">
        <div className="dashboard-banner">
          <div>
            <p className="eyebrow">ЛИЧНЫЙ КАБИНЕТ</p>
            <h1>Здравствуйте, {profile?.display_name || "друг"}!</h1>
            <p>Здесь собраны только ваши личные альбомы.</p>
          </div>
          <button className="primary" onClick={create}>
            <Plus size={17} />
            Новый альбом
          </button>
        </div>
        <div className="stats">
          <div>
            <b>{albums.length}</b>
            <span>альбомов</span>
          </div>
          <div>
            <b>
              {albums.reduce(
                (sum, album) => sum + (album.album_folders?.length || 0),
                0,
              )}
            </b>
            <span>папок</span>
          </div>
          <div>
            <b>
              <ShieldCheck size={17} />
            </b>
            <span>приватный доступ</span>
          </div>
        </div>
        <h2>Мои альбомы</h2>
        {albums.length ? (
          <div className="album-list">
            {albums.map((album) => (
              <article key={album.id}>
                <div
                  className="album-swatch"
                  style={{ background: album.background }}
                >
                  <Heart size={21} fill="currentColor" />
                </div>
                <section>
                  <small>
                    <Lock size={11} />
                    Защищён паролем
                  </small>
                  <h3>{album.title}</h3>
                  <p>
                    {album.album_folders?.length || 0} папок ·{" "}
                    {album.media?.length || 0} файлов без папки
                  </p>
                  <button onClick={() => choose(album)}>
                    Открыть альбом →
                  </button>
                </section>
                <MoreHorizontal size={18} />
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-card">
            <Heart size={28} />
            <h3>Здесь появятся ваши альбомы</h3>
            <p>
              Чужие альбомы не отображаются, пока их ссылкой и паролем не
              поделились с вами.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
function SignedAvatar({ path }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    supabase.storage
      .from("avatars")
      .createSignedUrl(path, 3600)
      .then(({ data }) => setSrc(data?.signedUrl || ""));
  }, [path]);
  return src ? <img src={src} alt="Аватар" /> : <UserRound size={19} />;
}

function Modal({ children, close }) {
  return (
    <div className="modal-backdrop" onMouseDown={close}>
      <section className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <button className="close" onClick={close}>
          <X size={19} />
        </button>
        {children}
      </section>
    </div>
  );
}
function CreateAlbum({ done, notify }) {
  const [title, setTitle] = useState(""),
    [password, setPassword] = useState(""),
    [background, setBackground] = useState(backgrounds[0]),
    [busy, setBusy] = useState(false);
  const level = score(password);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const slug = `${title
      .toLowerCase()
      .trim()
      .replace(/[^a-zа-я0-9]+/gi, "-")
      .replace(/(^-|-$)/g, "")}-${crypto.randomUUID().slice(0, 8)}`;
    const { data, error } = await supabase.rpc("create_album", {
      album_title: title,
      album_slug: slug,
      album_password: password,
      album_background: background,
    });
    setBusy(false);
    if (error) return notify(messageFrom(error));
    done(data);
  };
  return (
    <form onSubmit={submit}>
      <p className="eyebrow">НОВЫЙ АЛЬБОМ</p>
      <h2>Сохраните историю</h2>
      <Field label="Название альбома">
        <input
          required
          maxLength="100"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Например, Семья Ивановых"
        />
      </Field>
      <PasswordField
        label="Пароль для гостей"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Не менее 8 символов"
        minLength={8}
      />
      <div className="meter">
        <div>
          {[1, 2, 3, 4].map((x) => (
            <i key={x} className={level >= x ? "on" : ""} />
          ))}
        </div>
        <span>
          {
            [
              "Введите пароль",
              "Слабый пароль",
              "Нормальный пароль",
              "Хороший пароль",
              "Надёжный пароль",
            ][level]
          }
        </span>
      </div>
      <p className="field-label">Выберите фон</p>
      <div className="backgrounds">
        {backgrounds.map((color) => (
          <button
            type="button"
            aria-label="Выбрать фон"
            key={color}
            style={{ background: color }}
            className={background === color ? "chosen" : ""}
            onClick={() => setBackground(color)}
          />
        ))}
      </div>
      <button className="primary" disabled={busy || level < 2}>
        {busy ? "Создаём…" : "Создать альбом"}
      </button>
    </form>
  );
}

function EditAlbumModal({ album, user, notify, close, onAlbumDeleted }) {
  const [background, setBackground] = useState(album.background);
  const [customBgFile, setCustomBgFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fileInput = useRef(null);

  const handleCustomBackground = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setBusy(true);
    const path = `${user.id}/${album.id}/bg-${crypto.randomUUID()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from("album-media")
      .upload(path, file);
    
    if (uploadError) {
      notify(messageFrom(uploadError));
      setBusy(false);
      return;
    }

    const { data } = await supabase.storage
      .from("album-media")
      .getPublicUrl(path);
    
    setBackground(data.publicUrl);
    setCustomBgFile(path);
    setBusy(false);
  };

  const saveChanges = async () => {
    setBusy(true);
    const { error } = await supabase
      .from("albums")
      .update({ background })
      .eq("id", album.id);
    
    setBusy(false);
    if (error) {
      notify(messageFrom(error));
      return;
    }
    notify("Альбом обновлён.", "success");
    close();
    window.location.reload(); // Перезагрузим страницу для обновления фона
  };

  const deleteAlbum = async () => {
    if (
      !window.confirm(
        `Удалить альбом "${album.title}" и все его содержимое? Это действие нельзя отменить.`,
      )
    )
      return;

    setDeleting(true);

    // Удаляем все медиа файлы из storage
    const { data: mediaFiles } = await supabase
      .from("media")
      .select("file_path")
      .eq("album_id", album.id);

    if (mediaFiles && mediaFiles.length > 0) {
      const paths = mediaFiles.map((m) => m.file_path);
      await supabase.storage.from("album-media").remove(paths);
    }

    // Удаляем сам альбом (каскадно удалятся связанные записи благодаря ON DELETE CASCADE)
    const { error } = await supabase.from("albums").delete().eq("id", album.id);

    setDeleting(false);

    if (error) {
      notify(messageFrom(error));
      return;
    }

    notify("Альбом удалён.", "success");
    onAlbumDeleted?.();
  };

  return (
    <div>
      <p className="eyebrow">НАСТРОЙКИ АЛЬБОМА</p>
      <h2>{album.title}</h2>

      <p className="field-label">Выберите фон</p>
      <div className="backgrounds">
        {backgrounds.map((color) => (
          <button
            type="button"
            aria-label="Выбрать фон"
            key={color}
            style={{ background: color }}
            className={background === color ? "chosen" : ""}
            onClick={() => setBackground(color)}
          />
        ))}
      </div>

      <Field label="Или загрузите своё изображение">
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          onChange={handleCustomBackground}
          style={{ padding: "8px 0" }}
        />
        <small style={{ display: "block", marginTop: "8px", color: "#666" }}>
          Изображение будет адаптировано под размер экрана
        </small>
      </Field>

      {customBgFile && (
        <p style={{ color: "#4CAF50", marginTop: "8px", fontSize: "14px" }}>
          ✓ Кастомный фон загружен
        </p>
      )}

      <button
        className="primary"
        onClick={saveChanges}
        disabled={busy}
        style={{ marginTop: "20px", width: "100%" }}
      >
        {busy ? "Сохраняем…" : "Сохранить изменения"}
      </button>

      <hr style={{ margin: "30px 0", border: "none", borderTop: "1px solid #e0e0e0" }} />

      <h3 style={{ color: "#d32f2f", marginBottom: "10px" }}>Опасная зона</h3>
      <p style={{ fontSize: "14px", color: "#666", marginBottom: "15px" }}>
        Удаление альбома необратимо. Все фото, видео и папки будут удалены.
      </p>
      <button
        className="secondary"
        onClick={deleteAlbum}
        disabled={deleting}
        style={{
          width: "100%",
          background: deleting ? "#ccc" : "#ffebee",
          color: deleting ? "#666" : "#d32f2f",
          border: "1px solid #d32f2f",
        }}
      >
        <Trash2 size={16} />
        {deleting ? "Удаляем…" : "Удалить альбом"}
      </button>
    </div>
  );
}

function CreateFolder({ album, notify, close }) {
  const [name, setName] = useState(""),
    [color, setColor] = useState("#DCE9E3"),
    [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase
      .from("album_folders")
      .insert({ album_id: album.id, name: name.trim(), color });
    setBusy(false);
    if (error) return notify(messageFrom(error));
    notify("Папка создана.", "success");
    close();
  };
  return (
    <form onSubmit={submit}>
      <p className="eyebrow">НОВАЯ ПАПКА</p>
      <h2>Соберите воспоминания</h2>
      <Field label="Название папки">
        <input
          required
          autoFocus
          maxLength="100"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Например, Море 2025"
        />
      </Field>
      <Field label="Цвет папки">
        <div className="color-row">
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
          />
          <span>Выберите любой цвет из палитры</span>
        </div>
      </Field>
      <button className="primary" disabled={busy}>
        {busy ? "Создаём…" : "Создать папку"}
      </button>
    </form>
  );
}
function Share({ album, close }) {
  const link = `${appUrl}/a/${album.slug}`;
  return (
    <div className="share-modal">
      <span className="success">
        <Check size={25} />
      </span>
      <p className="eyebrow">АЛЬБОМ ГОТОВ</p>
      <h2>Отправьте ссылку близким</h2>
      <p>
        Ссылка бессрочная. Гость сможет войти только после ввода пароля альбома
        и авторизации.
      </p>
      <div className="share-link">
        <a href={link} target="_blank" rel="noreferrer">
          {link}
        </a>
        <button onClick={() => navigator.clipboard.writeText(link)}>
          Копировать
        </button>
      </div>
      <button className="primary" onClick={close}>
        Понятно
      </button>
    </div>
  );
}
function FolderModal({ folder, album, user, notify }) {
  const [name, setName] = useState(folder.name);
  const [color, setColor] = useState(folder.color || "#DCE9E3");
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [viewerMedia, setViewerMedia] = useState(null);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    // Проверяем владельца
    supabase
      .from("albums")
      .select("owner_id")
      .eq("id", album.id)
      .single()
      .then(({ data }) => {
        setIsOwner(data?.owner_id === user.id);
      });

    supabase
      .from("media")
      .select("*")
      .eq("folder_id", folder.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setFiles(data || []));
  }, [folder.id, album.id, user.id]);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("album_folders")
      .update({ name, color })
      .eq("id", folder.id);
    setSaving(false);
    if (error) notify(messageFrom(error));
    else notify("Папка сохранена.", "success");
  };

  const handleMediaDelete = (deletedId) => {
    setFiles((prev) => prev.filter((m) => m.id !== deletedId));
  };

  return (
    <div>
      <p className="eyebrow">ПАПКА АЛЬБОМА</p>
      <h2>Настройки и файлы</h2>
      <Field label="Название">
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Цвет папки">
        <div className="color-row">
          <input
            aria-label="Цвет папки"
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
          />
          <span>Выберите любой цвет в палитре</span>
        </div>
      </Field>
      <button
        className="secondary save-folder"
        onClick={save}
        disabled={saving}
      >
        <Palette size={15} />
        {saving ? "Сохраняем…" : "Сохранить папку"}
      </button>
      <MediaGrid
        items={files}
        onMediaClick={(item) => setViewerMedia(item)}
      />
      <UploadModal
        album={album}
        folder={folder}
        user={user}
        notify={notify}
        onUploaded={(items) => setFiles((old) => [...items, ...old])}
      />
      {viewerMedia && (
        <MediaViewer
          media={viewerMedia}
          allMedia={files}
          onClose={() => setViewerMedia(null)}
          onDelete={handleMediaDelete}
          isOwner={isOwner}
        />
      )}
    </div>
  );
}
function UploadModal({ album, folder, user, notify, onUploaded }) {
  const input = useRef(null),
    [busy, setBusy] = useState(false),
    [count, setCount] = useState(0);
  const upload = async (e) => {
    const picked = Array.from(e.target.files || []).slice(0, 35);
    if (!picked.length) return;
    setBusy(true);
    setCount(picked.length);
    const added = [];
    for (const file of picked) {
      const safe = file.name.replace(/[^a-zA-Zа-яА-Я0-9._-]/g, "_");
      const path = `${user.id}/${album.id}/${folder?.id || "direct"}/${crypto.randomUUID()}-${safe}`;
      const { error: uploadError } = await supabase.storage
        .from("album-media")
        .upload(path, file);
      if (uploadError) {
        setBusy(false);
        return notify(messageFrom(uploadError));
      }
      const { data, error } = await supabase
        .from("media")
        .insert({
          album_id: album.id,
          folder_id: folder?.id || null,
          file_path: path,
          media_type: file.type.startsWith("video/") ? "video" : "image",
        })
        .select()
        .single();
      if (error) {
        setBusy(false);
        return notify(messageFrom(error));
      }
      added.push(data);
    }
    setBusy(false);
    notify(`${added.length} файлов добавлено.`, "success");
    onUploaded?.(added);
  };
  return (
    <div className="upload-area">
      <input
        ref={input}
        hidden
        type="file"
        accept="image/*,video/*"
        multiple
        onChange={upload}
      />
      <button onClick={() => input.current.click()} disabled={busy}>
        <Upload size={19} />
        <b>{busy ? `Загружаем ${count} файлов…` : "Добавить фото или видео"}</b>
        <span>До 35 файлов за одну загрузку</span>
      </button>
    </div>
  );
}
function SettingsModal({ user, profile, notify, close }) {
  const [name, setName] = useState(profile?.display_name || ""),
    [avatar, setAvatar] = useState(profile?.avatar_path || null),
    [busy, setBusy] = useState(false);
  const file = useRef(null);
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .upsert({ id: user.id, display_name: name.trim(), avatar_path: avatar });
    setBusy(false);
    if (error) return notify(messageFrom(error));
    notify("Профиль сохранён.", "success");
    close();
  };
  const upload = async (e) => {
    const image = e.target.files?.[0];
    if (!image) return;
    setBusy(true);
    const path = `${user.id}/${crypto.randomUUID()}-${image.name}`;
    const { error } = await supabase.storage
      .from("avatars")
      .upload(path, image);
    setBusy(false);
    if (error) return notify(messageFrom(error));
    setAvatar(path);
  };
  return (
    <form onSubmit={save}>
      <p className="eyebrow">НАСТРОЙКИ ПРОФИЛЯ</p>
      <h2>Личные данные</h2>
      <div className="avatar-editor">
        <span className="avatar huge">
          {avatar ? <SignedAvatar path={avatar} /> : <UserRound size={28} />}
        </span>
        <button
          type="button"
          className="secondary"
          onClick={() => file.current.click()}
        >
          <Camera size={16} />
          Изменить аватар
        </button>
        <input
          hidden
          ref={file}
          type="file"
          accept="image/*"
          onChange={upload}
        />
      </div>
      <Field label="Ваше имя">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Например, Ирина"
        />
      </Field>
      <Field label="Электронная почта">
        <input disabled value={user.email} />
      </Field>
      <button className="primary" disabled={busy}>
        {busy ? "Сохраняем…" : "Сохранить изменения"}
      </button>
    </form>
  );
}
function Toast({ text, type, close }) {
  return (
    <div className={`toast ${type}`}>
      <span>{text}</span>
      <button onClick={close}>
        <X size={16} />
      </button>
    </div>
  );
}
createRoot(document.getElementById("root")).render(<App />);
