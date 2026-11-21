import { useIsMobile } from "@/hooks/use-mobile";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";

export default function FormDialog({ open, onOpenChange, title, description, children, footer, wide = false }) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[92vh]">
          <DrawerHeader className="text-left">
            <DrawerTitle className="text-base">{title}</DrawerTitle>
            {description && <p className="text-[12px] text-[#64748B]">{description}</p>}
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-8">{children}</div>
          {footer && <div className="border-t border-[#E2E8F0] p-4">{footer}</div>}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`max-h-[90vh] overflow-y-auto ${wide ? "sm:max-w-2xl" : "sm:max-w-lg"}`}>
        <DialogHeader>
          <DialogTitle className="text-base">{title}</DialogTitle>
          {description && <p className="text-[12px] text-[#64748B]">{description}</p>}
        </DialogHeader>
        <div className="py-2">{children}</div>
        {footer}
      </DialogContent>
    </Dialog>
  );
}