import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { LuFile, LuUpload, LuX } from 'react-icons/lu'
import { FILE_ACCEPT } from '../../config/site'
import { formatBytes } from '../../utils/format'
import { FieldLabel, FieldMessage } from './Field'

export const FileField = forwardRef(function FileField({ id, label, hint, error, required = true, file, onChange }, ref) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const messageId = `${id}-message`
  useImperativeHandle(ref, () => inputRef.current)

  const clear = () => {
    inputRef.current.value = ''
    onChange(null)
    inputRef.current.focus()
  }

  const onDrop = (event) => {
    event.preventDefault()
    setDragging(false)
    const dropped = event.dataTransfer.files[0]
    if (dropped) onChange(dropped)
  }

  return (
    <div>
      <FieldLabel htmlFor={id} required={required}>{label}</FieldLabel>
      <input
        ref={inputRef}
        id={id}
        name={id}
        type="file"
        accept={FILE_ACCEPT}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={messageId}
        className="peer sr-only"
        onChange={(event) => onChange(event.target.files[0] ?? null)}
      />
      {file ? (
        <div className={`flex items-center gap-3 rounded-[4px] border-[1.5px] bg-sheet px-3 py-3 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ug-700 ${error ? 'border-danger' : 'border-line-strong'}`}>
          <LuFile aria-hidden="true" className="size-5 shrink-0 text-ink-2" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">{file.name}</p>
            <p className="text-sm text-ink-3">{formatBytes(file.size)}</p>
          </div>
          <label htmlFor={id} className="cursor-pointer rounded-md px-3 py-2 text-sm font-semibold text-ink hover:bg-ink/5">Ganti</label>
          <button type="button" onClick={clear} className="inline-flex size-10 items-center justify-center rounded-md text-ink-2 hover:bg-ink/5 hover:text-ink">
            <LuX aria-hidden="true" className="size-5" />
            <span className="sr-only">Hapus {file.name}</span>
          </button>
        </div>
      ) : (
        <label
          htmlFor={id}
          onDragOver={(event) => { event.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`flex cursor-pointer items-center gap-4 rounded-[4px] border-[1.5px] border-dashed px-4 py-4 transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ug-700 ${dragging ? 'border-ug-700 bg-ug-100' : error ? 'border-danger bg-sheet' : 'border-line-strong bg-sheet hover:border-ug-700'}`}
        >
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-[4px] bg-ug-100 text-ug-700">
            <LuUpload aria-hidden="true" className="size-5" />
          </span>
          <span className="text-sm">
            <span className="block font-semibold text-ink">Pilih file atau ambil foto</span>
            <span className="block text-ink-3">JPG, PNG, atau PDF · maks. 2 MB</span>
          </span>
        </label>
      )}
      <FieldMessage id={messageId} error={error} hint={hint} />
    </div>
  )
})
