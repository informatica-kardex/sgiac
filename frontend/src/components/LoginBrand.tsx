import "../styles/login-brand.css";

export function LoginBrand() {
  return (
    <img
      src="/images/kardex.png"
      alt="Kardex — Carrera de Informática"
      width={640}
      height={640}
      className="mx-auto h-auto w-full max-w-[152px] object-contain"
    />
  );
}

export function LoginBackdrop() {
  return (
    <>
      <span aria-hidden="true" className="login-background-logo login-background-kardex" />
      <span aria-hidden="true" className="login-background-logo login-background-career" />
    </>
  );
}
