import { useState, useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import LinkExtension from "@tiptap/extension-link";
import DOMPurify from "dompurify";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Link,
  Unlink,
  Heading2,
  NotebookPen,
  Eye,
} from "lucide-react";
export const cleanNotes = (html) =>
  DOMPurify.sanitize(html || "", {
    ALLOWED_TAGS: [
      "p",
      "br",
      "strong",
      "em",
      "s",
      "ul",
      "ol",
      "li",
      "h2",
      "h3",
      "blockquote",
      "a",
      "code",
    ],
    ALLOWED_ATTR: ["href", "target", "rel"],
    ALLOW_DATA_ATTR: false,
  });
export function NotesPreview({ html }) {
  return (
    <div
      className="rich-preview"
      dangerouslySetInnerHTML={{ __html: cleanNotes(html) }}
    />
  );
}
export default function RichNotes({ value = "", onChange }) {
  const [editing, setEditing] = useState(!value),
    [linkOpen, setLinkOpen] = useState(false),
    [url, setUrl] = useState(""),
    [error, setError] = useState("");
  const callback = useRef(onChange);
  callback.current = onChange;
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: false, heading: { levels: [2, 3] } }),
      LinkExtension.configure({
        openOnClick: false,
        autolink: true,
        protocols: ["http", "https", "mailto"],
        HTMLAttributes: { target: "_blank", rel: "noopener noreferrer" },
      }),
    ],
    content: cleanNotes(value),
    editorProps: {
      attributes: {
        "aria-label": "Stock notes editor",
        role: "textbox",
        "aria-multiline": "true",
        class: "notes-prose",
      },
    },
    onUpdate: ({ editor }) => {
      const html = cleanNotes(editor.getHTML());
      if (html.length > 50000) {
        setError("Notes are limited to 50,000 characters.");
        return;
      }
      callback.current(html);
      setError("");
    },
  });
  useEffect(() => {
    if (editor && cleanNotes(value) !== cleanNotes(editor.getHTML()))
      editor.commands.setContent(cleanNotes(value), { emitUpdate: false });
  }, [value, editor]);
  function applyLink(e) {
    e.preventDefault();
    try {
      const u = new URL(url);
      if (!["http:", "https:", "mailto:"].includes(u.protocol)) throw Error();
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href: u.href })
        .run();
      setLinkOpen(false);
      setError("");
    } catch {
      setError("Use a full https://, http://, or mailto: link.");
    }
  }
  const controls = [
    ["Bold", Bold, () => editor.chain().focus().toggleBold().run(), "bold"],
    [
      "Italic",
      Italic,
      () => editor.chain().focus().toggleItalic().run(),
      "italic",
    ],
    [
      "Heading",
      Heading2,
      () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      "heading",
    ],
    [
      "Bullet list",
      List,
      () => editor.chain().focus().toggleBulletList().run(),
      "bulletList",
    ],
    [
      "Numbered list",
      ListOrdered,
      () => editor.chain().focus().toggleOrderedList().run(),
      "orderedList",
    ],
  ];
  return (
    <section className="stock-notes">
      <div className="notes-heading">
        <div>
          <h3>
            <NotebookPen size={16} />
            Stock notes
          </h3>
          <span>
            Shared between this member's holdings and watchlists for this
            listing.
          </span>
        </div>
        <button className="text-button" onClick={() => setEditing(!editing)}>
          {editing ? (
            <>
              <Eye size={14} />
              Read notes
            </>
          ) : (
            <>
              <NotebookPen size={14} />
              Edit notes
            </>
          )}
        </button>
      </div>
      {editing ? (
        <>
          <div
            className="notes-toolbar"
            role="toolbar"
            aria-label="Notes formatting"
          >
            {controls.map(([label, Icon, action, active]) => (
              <button
                type="button"
                key={label}
                aria-label={label}
                title={label}
                aria-pressed={editor?.isActive(active) || false}
                onMouseDown={(e) => e.preventDefault()}
                onClick={action}
                disabled={!editor}
              >
                <Icon size={16} />
              </button>
            ))}
            <span />
            <button
              type="button"
              aria-label="Insert link"
              title="Insert link"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setUrl(editor?.getAttributes("link").href || "https://");
                setLinkOpen(!linkOpen);
              }}
            >
              <Link size={16} />
            </button>
            <button
              type="button"
              aria-label="Remove link"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor.chain().focus().unsetLink().run()}
            >
              <Unlink size={16} />
            </button>
            <small>Saved automatically</small>
          </div>
          {linkOpen && (
            <form className="link-entry" onSubmit={applyLink}>
              <input
                autoFocus
                aria-label="Link URL"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
              />
              <button className="primary">Apply link</button>
            </form>
          )}
          <EditorContent editor={editor} />
        </>
      ) : value && value !== "<p></p>" ? (
        <NotesPreview html={value} />
      ) : (
        <p className="caption">
          No notes yet. Add your research, investment thesis, and useful links.
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
