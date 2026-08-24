export default function clsx(
  ...args: Array<string | false | null | undefined>
) {
  return args.filter(Boolean).join(" ");
}
