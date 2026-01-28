import React, { useCallback, useState } from 'react';
import { UploadCloud, FileText, Loader2, AlertCircle, FileArchive } from 'lucide-react';
import { extractTextFromPdf, extractTextFromDocx, extractTextFromZip, cleanupWhitespaceBasic } from '../utils/textProcessing';
import { RawFile } from '../types';

interface Props {
  onFileLoaded: (files: RawFile[], mainFileName: string) => void;
}

const FileUpload: React.FC<Props> = ({ onFileLoaded }) => {
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setIsParsing(true);

    try {
      setTimeout(async () => {
        try {
          let files: RawFile[] = [];
          
          if (file.type === 'application/zip' || file.name.endsWith('.zip')) {
            files = await extractTextFromZip(file);
            if (files.length === 0) throw new Error("No valid text files found in ZIP archive.");
          } else if (file.type === 'application/pdf') {
            const text = await extractTextFromPdf(file);
            if (!text.trim()) throw new Error("No text found in PDF.");
            files.push({ name: file.name, content: text });
          } else if (
            file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
            file.name.endsWith('.docx')
          ) {
            const text = await extractTextFromDocx(file);
            if (!text.trim()) throw new Error("No text found in DOCX.");
            files.push({ name: file.name, content: text });
          } else {
            // Plain Text fallback
            const text = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = (e) => resolve(e.target?.result as string || '');
              reader.onerror = () => reject(new Error("Failed to read text file."));
              reader.readAsText(file);
            });
            files.push({ name: file.name, content: cleanupWhitespaceBasic(text) });
          }

          onFileLoaded(files, file.name);
        } catch (e: any) {
          console.error(e);
          setError(e.message || "Failed to parse file.");
          setIsParsing(false);
        }
      }, 100);

    } catch (e) {
      setError("An unexpected error occurred.");
      setIsParsing(false);
    }
  }, [onFileLoaded]);

  return (
    <div className="max-w-2xl mx-auto mt-20 p-8">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-serif font-bold text-gray-900 dark:text-gray-100 mb-4 transition-colors">Lumina Scanner</h1>
        <p className="text-gray-500 dark:text-gray-400 text-lg transition-colors">Profesjonalny skaner błędów językowych</p>
      </div>

      <label className={`flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-xl transition-all group relative overflow-hidden 
        ${isParsing 
          ? 'border-brand-300 bg-brand-50 dark:bg-brand-900/20 dark:border-brand-700 cursor-wait' 
          : 'border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 hover:bg-white dark:hover:bg-gray-800 hover:border-brand-500 dark:hover:border-brand-500 cursor-pointer'}`}>
        
        {isParsing ? (
          <div className="flex flex-col items-center justify-center z-10 animate-pulse">
            <Loader2 className="w-12 h-12 text-brand-600 dark:text-brand-500 animate-spin mb-4" />
            <p className="text-brand-800 dark:text-brand-300 font-medium">Procesowanie tekstu...</p>
            <p className="text-brand-600 dark:text-brand-400 text-xs mt-1">Wyodrębnianie tekstu & rozdziałów...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <div className="p-4 bg-brand-50 dark:bg-gray-700/50 rounded-full mb-4 group-hover:scale-110 transition-transform">
               <UploadCloud className="w-10 h-10 text-brand-500" />
            </div>
            <p className="mb-2 text-sm text-gray-600 dark:text-gray-300 font-medium">Kliknij aby przesłać</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">Wspierane: .zip (Wielo-rozdziałowy), .docx, .pdf, .txt</p>
          </div>
        )}

        <input 
          type="file" 
          className="hidden" 
          accept=".zip,.txt,.pdf,.docx,application/zip,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={handleFileChange}
          disabled={isParsing}
        />
      </label>

      {error && (
        <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      <div className="mt-8 flex gap-4 justify-center text-gray-400 dark:text-gray-600 text-xs transition-colors">
         <div className="flex items-center gap-1"><FileArchive size={14}/> Wsparcie wielu plików w .zip</div>
         <div className="flex items-center gap-1"><FileText size={14}/> Inteligentna segmentacja</div>
         <div className="flex items-center gap-1"><FileText size={14}/> Polska typografia</div>
      </div>
    </div>
  );
};

export default FileUpload;