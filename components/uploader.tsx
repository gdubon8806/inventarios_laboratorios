'use client'

import { useState, useCallback, useMemo, ChangeEvent } from 'react'
// import '../node_modules/react-hot-toast';
import toast, { Toaster } from 'react-hot-toast';

import LoadingDots from './loading-dots'
import { PutBlobResult } from '@vercel/blob'
import Compressor from 'compressorjs';
import { uploadImage } from './firebaseStuff/uploadImages';

export default function Uploader({setImgURL, setImgName}) {
  const [data, setData] = useState<{
    image: string | null
  }>({
    image: null,
  })
  const [file, setFile] = useState<File | Blob | null>(null); // Ajuste de tipo aquí

  const [dragActive, setDragActive] = useState(false)

  const onChangePicture = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.currentTarget.files && event.currentTarget.files[0]
      if (file) {
        if (file.size / 1024 / 1024 > 50) {
          toast.error('File size too big (max 50MB)')
        } else {
          new Compressor(file, {
            quality: 0.8,
            maxWidth: 1200,
            maxHeight:  1200,
            success: (compressedFile) => {
              setFile(compressedFile);
              const reader = new FileReader();
              reader.onload = (e) => {
                setData((prev) => ({ ...prev, image: e.target?.result as string }));
              };
              reader.readAsDataURL(compressedFile);
            },
            error: (error) => {
              console.error('Compression error:', error);
            },
          });
        }
      }
    },
    [setData]
  )

  const [saving, setSaving] = useState(false)

  const saveDisabled = useMemo(() => {
    return !data.image || saving
  }, [data.image, saving])
  return (
    <>
    <form
      className="grid gap-6 form-uploader"
      onSubmit={async (e) => {
        e.preventDefault()
        setSaving(true);
        await uploadImage(file)
        .then(async (res) => {
          if (res[0] === 1) {
            // const { url } = (await res.json()) as PutBlobResult
            setImgURL(res[1]);
            console.log(res[2]);
            setImgName(res[2]);
            toast(
              (t: { id: string } 
                ) => (
                <div className="relative">
                  <div className="p-4">
                    <p className="font-semibold text-gray-900">
                      ¡Imagen subida exitosamente!
                    </p>
                  </div>

                  {/* <button
                    onClick={() => toast.dismiss(t.id)}
                    className="absolute top-0 -right-2 inline-flex text-gray-400 focus:outline-none focus:text-gray-500 rounded-full p-1.5 hover:bg-gray-100 transition ease-in-out duration-150"
                  >
                    <svg
                      className="h-5 w-5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M5.293 5.293a1 1 0 011.414 0L10
                          8.586l3.293-3.293a1 1 0 111.414 1.414L11.414
                          10l3.293 3.293a1 1 0 01-1.414 1.414L10
                          11.414l-3.293 3.293a1 1 0 01-1.414-1.414L8.586
                          10 5.293 6.707a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button> */}
                </div>
              ),
              { duration: 2500 }
            )
          } else {
            // const error = await res.text()
            toast.error("Error")
          }
          setSaving(false)
        })
      }}
    >
      <div>
        <div className="space-y-1 mb-4">
          <p className="text-xl text-center">Subir imagen</p>
          <p className="text-sm text-gray-500 text-center">
            Formatos aceptados: .png, .jpg, .gif
          </p>
        </div>
        <label
          htmlFor="image-upload"
          className="group relative mt-2 flex h-72 cursor-pointer flex-col items-center justify-center rounded-md border border-gray-300 bg-white shadow-sm transition-all hover:bg-gray-50"
        >
          <div
            className="absolute z-[5] h-full w-full rounded-md"
            onDragOver={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setDragActive(true)
            }}
            onDragEnter={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setDragActive(true)
            }}
            onDragLeave={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setDragActive(false)
            }}
            onDrop={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setDragActive(false)

              const file = e.dataTransfer.files && e.dataTransfer.files[0]
              if (file) {
                if (file.size / 1024 / 1024 > 50) {
                  toast.error('File size too big (max 50MB)')
                } else {
                  setFile(file)
                  const reader = new FileReader()
                  reader.onload = (e) => {
                    setData((prev) => ({
                      ...prev,
                      image: e.target?.result as string,
                    }))
                  }
                  reader.readAsDataURL(file)
                }
              }
            }}
          />
          <div
            className={`${
              dragActive ? 'border-2 border-black' : ''
            } absolute z-[3] flex h-full w-full flex-col items-center justify-center rounded-md px-10 transition-all ${
              data.image
                ? 'bg-white/80 opacity-0 hover:opacity-100 hover:backdrop-blur-md'
                : 'bg-white opacity-100 hover:bg-gray-50'
            }`}
          >
            <svg
              className={`${
                dragActive ? 'scale-110' : 'scale-100'
              } h-7 w-7 text-gray-500 transition-all duration-75 group-hover:scale-110 group-active:scale-95`}
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"></path>
              <path d="M12 12v9"></path>
              <path d="m16 16-4-4-4 4"></path>
            </svg>
            <p className="mt-2 text-center text-sm text-gray-500">
              Arrastre y suelte o dar clic a subir.
            </p>
            <p className="mt-2 text-center text-sm text-gray-500">
              Tamaño máximo: 50MB
            </p>
          </div>
          {data.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.image}
              alt="Preview"
              className="h-full w-full rounded-md object-cover"
            />
          )}
        </label>
        <div className="mt-1 flex rounded-md shadow-sm">
          <input
            id="image-upload"
            name="image"
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={onChangePicture}
          />
        </div>
      </div>

      <button
        disabled={saveDisabled}
        className={`${
          saveDisabled
            ? 'cursor-not-allowed border-lightgray-200 bg-gray-100 text-gray-400'
            : 'border-white bg-white text-blue-600 hover:bg-blue-50'
        } flex h-10 w-full items-center justify-center rounded-md border text-sm transition-all focus:outline-none`}
      >
        {saving ? (
          <LoadingDots color="#808080" />
        ) : (
          <p className="text-sm">CONFIRMAR SUBIR IMAGEN</p>
        )}
      </button>
    </form>
  </>
  )
}
