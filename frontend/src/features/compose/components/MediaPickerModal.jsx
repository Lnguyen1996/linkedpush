import { FolderOpen, Play, FileText } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export default function MediaPickerModal({ open, onOpenChange, libraryItems, onSelect }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh]" showCloseButton>
        <DialogHeader>
          <DialogTitle>Select from Media Library</DialogTitle>
        </DialogHeader>
        <div className="overflow-auto max-h-[60vh]">
          {libraryItems.length === 0 ? (
            <div className="text-center py-12">
              <FolderOpen size={32} className="text-white/30 mx-auto mb-2" />
              <p className="text-white/55 text-sm">No media in library</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {libraryItems.map(item => {
                const mType = item.media_type || 'image'
                return (
                  <button
                    key={item.id}
                    onClick={() => onSelect(item)}
                    className="group relative aspect-square rounded-xl overflow-hidden border-2 border-white/10 hover:border-purple transition-all hover:shadow-md"
                  >
                    {mType === 'image' ? (
                      <img src={`/api/media/${item.id}/file`} alt={item.original_filename} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
                    ) : mType === 'video' ? (
                      <div className="w-full h-full bg-black/40 flex items-center justify-center">
                        <Play size={28} className="text-white/60" />
                      </div>
                    ) : (
                      <div className="w-full h-full bg-blue-500/5 flex flex-col items-center justify-center gap-1">
                        <FileText size={28} className="text-blue-400/60" />
                        <span className="text-[10px] text-white/55 truncate px-2 max-w-full">{item.original_filename}</span>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
