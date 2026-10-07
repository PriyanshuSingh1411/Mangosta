"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/app/components/AuthProvider";
import { useWishlistStore } from "@/app/store/useWishlistStore";
import { useToast } from "@/app/components/ToastProvider";

const DEFAULT_FOLDER = "All saved";

export default function WishlistButton({
  productId,
  productName,
  className = "",
  size = "md",
  withLabel = false,
}: {
  productId: string;
  productName: string;
  className?: string;
  size?: "sm" | "md";
  withLabel?: boolean;
}) {
  const { user, loading: authLoading, openAuth } = useAuth();
  const { toast } = useToast();

  const saved = useWishlistStore((state) =>
    state.productIds.includes(productId)
  );

  const load = useWishlistStore((state) => state.load);
  const reset = useWishlistStore((state) => state.reset);
  const setSaved = useWishlistStore((state) => state.setSaved);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [folders, setFolders] = useState<string[]>([DEFAULT_FOLDER]);
  const [selectedFolder, setSelectedFolder] = useState(DEFAULT_FOLDER);

  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const [loadingFolders, setLoadingFolders] = useState(false);
  const [saving, setSaving] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);

  useEffect(() => {
    if (authLoading) return;

    if (user) {
      void load(user.id);
    } else {
      reset();
    }
  }, [authLoading, user, load, reset]);

  const loadFolders = async () => {
    if (!user) return;

    setLoadingFolders(true);

    try {
      const response = await fetch("/api/wishlist", {
        cache: "no-store",
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        toast(
          data?.error || "Could not load wishlist folders",
          "error"
        );
        return;
      }

      const availableFolders =
        Array.isArray(data?.folders) && data.folders.length > 0
          ? data.folders
          : [DEFAULT_FOLDER];

      setFolders(availableFolders);

      const existingItem = Array.isArray(data?.items)
        ? data.items.find(
            (item: { productId?: string }) =>
              item.productId === productId
          )
        : null;

      setSelectedFolder(
        existingItem?.folder || DEFAULT_FOLDER
      );
    } catch {
      toast("Could not load wishlist folders", "error");
    } finally {
      setLoadingFolders(false);
    }
  };

  const openWishlistModal = async (
    event: React.MouseEvent<HTMLButtonElement>
  ) => {
    event.preventDefault();
    event.stopPropagation();

    if (authLoading) return;

    if (!user) {
      openAuth("signin", () => {
        setIsModalOpen(true);
        void loadFolders();
      });

      return;
    }

    setIsCreatingFolder(false);
    setNewFolderName("");
    setSelectedFolder(DEFAULT_FOLDER);
    setIsModalOpen(true);

    await loadFolders();
  };

  const closeModal = () => {
    if (saving || creatingFolder) return;

    setIsModalOpen(false);
    setIsCreatingFolder(false);
    setNewFolderName("");
  };

  const createFolder = async () => {
    const folder = newFolderName.trim();

    if (!folder) {
      toast("Enter a folder name", "error");
      return;
    }

    if (
      folder.toLowerCase() ===
      DEFAULT_FOLDER.toLowerCase()
    ) {
      toast("That folder already exists", "error");
      return;
    }

    const existingFolder = folders.some(
      (item) => item.toLowerCase() === folder.toLowerCase()
    );

    if (existingFolder) {
      toast(
        "A folder with this name already exists",
        "error"
      );
      return;
    }

    setCreatingFolder(true);

    try {
      const response = await fetch("/api/wishlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "create-folder",
          folder,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        toast(
          data?.error || "Could not create folder",
          "error"
        );
        return;
      }

      const updatedFolders =
        Array.isArray(data?.folders) &&
        data.folders.length > 0
          ? data.folders
          : [...folders, folder];

      setFolders(updatedFolders);
      setSelectedFolder(folder);

      setNewFolderName("");
      setIsCreatingFolder(false);

      toast(`${folder} folder created`, "success");
    } catch {
      toast("Could not create folder", "error");
    } finally {
      setCreatingFolder(false);
    }
  };

  const addToWishlist = async () => {
    if (!user) return;

    const folder = selectedFolder || DEFAULT_FOLDER;

    setSaving(true);

    try {
      /*
       * First make sure the product is saved in the main wishlist.
       */
      if (!saved) {
        const saveResponse = await fetch("/api/wishlist", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "save",
            productId,
            saved: true,
          }),
        });

        const saveData =
          await saveResponse.json().catch(() => null);

        if (!saveResponse.ok) {
          toast(
            saveData?.error ||
              "Could not add product to wishlist",
            "error"
          );
          return;
        }

        await setSaved(productId, true);
      }

      /*
       * Move the product into the selected custom folder.
       */
      if (folder !== DEFAULT_FOLDER) {
        const folderResponse = await fetch("/api/wishlist", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "folder",
            productId,
            folder,
          }),
        });

        const folderData =
          await folderResponse.json().catch(() => null);

        if (!folderResponse.ok) {
          toast(
            folderData?.error ||
              "Could not save product to folder",
            "error"
          );
          return;
        }
      }

      setIsModalOpen(false);
      setIsCreatingFolder(false);
      setNewFolderName("");

      toast(
        folder === DEFAULT_FOLDER
          ? `${productName} saved to wishlist`
          : `${productName} saved to ${folder}`,
        "success"
      );
    } catch {
      toast("Could not update your wishlist", "error");
    } finally {
      setSaving(false);
    }
  };

  const icon =
    size === "sm" ? "h-4 w-4" : "h-5 w-5";

  /*
   * Render the modal outside the component's parent DOM tree.
   *
   * This prevents parent elements with:
   * - transform
   * - filter
   * - perspective
   * - overflow
   * - positioning
   *
   * from affecting the fixed modal position.
   */
  const modal =
    isModalOpen && typeof document !== "undefined"
      ? createPortal(
          <div
            className="fixed inset-0 z-[99999] flex min-h-screen w-screen items-center justify-center bg-void/80 p-5 backdrop-blur-sm"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                closeModal();
              }
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="save-wishlist-title"
              className="relative flex w-full max-w-lg max-h-[90vh] flex-col overflow-hidden border border-line-strong bg-charcoal shadow-2xl"
            >
              {/* HEADER */}
              <div className="shrink-0 border-b border-line px-5 py-5 sm:px-7">
                <div className="flex items-start justify-between gap-5">
                  <div>
                    <p className="label-technical text-stone">
                      MANGOSTA / WISHLIST
                    </p>

                    <h2
                      id="save-wishlist-title"
                      className="mt-2 font-display text-3xl tracking-tight text-bone"
                    >
                      SAVE TO WISHLIST
                    </h2>

                    <p className="mt-2 text-xs leading-relaxed text-stone">
                      Choose where you want to save this piece.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={saving || creatingFolder}
                    aria-label="Close"
                    className="text-2xl leading-none text-stone transition-colors hover:text-bone disabled:opacity-40"
                  >
                    ×
                  </button>
                </div>
              </div>

              {/* CREATE FOLDER */}
              {isCreatingFolder ? (
                <div className="overflow-y-auto px-5 py-6 sm:px-7">
                  <p className="label-technical text-stone">
                    NEW FOLDER
                  </p>

                  <label
                    htmlFor="wishlist-new-folder"
                    className="mt-4 block text-xs text-stone"
                  >
                    Folder name
                  </label>

                  <input
                    id="wishlist-new-folder"
                    type="text"
                    value={newFolderName}
                    onChange={(event) =>
                      setNewFolderName(event.target.value)
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void createFolder();
                      }
                    }}
                    autoFocus
                    maxLength={40}
                    placeholder="e.g. Summer Fits"
                    className="mt-2 w-full border border-line-strong bg-void px-4 py-4 text-sm text-bone outline-none transition-colors placeholder:text-stone/60 focus:border-bone"
                  />

                  <div className="mt-6 flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setIsCreatingFolder(false);
                        setNewFolderName("");
                      }}
                      disabled={creatingFolder}
                      className="flex-1 border border-line-strong px-4 py-4 text-[10px] font-medium tracking-[0.16em] text-bone transition-colors hover:border-bone disabled:opacity-40"
                    >
                      BACK
                    </button>

                    <button
                      type="button"
                      onClick={() => void createFolder()}
                      disabled={
                        creatingFolder ||
                        !newFolderName.trim()
                      }
                      className="flex-1 bg-bone px-4 py-4 text-[10px] font-medium tracking-[0.16em] text-void transition-colors hover:bg-mango disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {creatingFolder
                        ? "CREATING…"
                        : "CREATE FOLDER"}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* FOLDERS */}
                  <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7">
                    <div className="space-y-2">
                      {loadingFolders ? (
                        <>
                          <div className="h-16 animate-pulse bg-void" />
                          <div className="h-16 animate-pulse bg-void" />
                          <div className="h-16 animate-pulse bg-void" />
                        </>
                      ) : (
                        folders.map((folder) => {
                          const selected =
                            selectedFolder === folder;

                          return (
                            <button
                              key={folder}
                              type="button"
                              onClick={() =>
                                setSelectedFolder(folder)
                              }
                              className={`flex w-full items-center justify-between border px-4 py-4 text-left transition-colors ${
                                selected
                                  ? "border-bone bg-bone text-void"
                                  : "border-line-strong bg-void text-bone hover:border-bone"
                              }`}
                            >
                              <span>
                                <span
                                  className={`block text-[11px] font-medium tracking-[0.14em] ${
                                    selected
                                      ? "text-void"
                                      : "text-bone"
                                  }`}
                                >
                                  {folder.toUpperCase()}
                                </span>

                                {folder === DEFAULT_FOLDER && (
                                  <span
                                    className={`mt-1 block text-[10px] ${
                                      selected
                                        ? "text-void/60"
                                        : "text-stone"
                                    }`}
                                  >
                                    Your main wishlist
                                  </span>
                                )}
                              </span>

                              <span
                                className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                                  selected
                                    ? "border-void"
                                    : "border-line-strong"
                                }`}
                              >
                                {selected && (
                                  <span className="h-2.5 w-2.5 rounded-full bg-void" />
                                )}
                              </span>
                            </button>
                          );
                        })
                      )}
                    </div>

                    {/* NEW FOLDER */}
                    <button
                      type="button"
                      onClick={() =>
                        setIsCreatingFolder(true)
                      }
                      disabled={loadingFolders}
                      className="mt-5 flex w-full items-center gap-3 border border-dashed border-line-strong px-4 py-4 text-left text-[10px] font-medium tracking-[0.16em] text-stone transition-colors hover:border-bone hover:text-bone disabled:opacity-40"
                    >
                      <span className="text-lg font-light leading-none">
                        +
                      </span>

                      <span>NEW FOLDER</span>
                    </button>
                  </div>

                  {/* FOOTER */}
                  <div className="shrink-0 border-t border-line px-5 py-5 sm:px-7">
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={closeModal}
                        disabled={saving}
                        className="flex-1 border border-line-strong px-4 py-4 text-[10px] font-medium tracking-[0.16em] text-bone transition-colors hover:border-bone disabled:opacity-40"
                      >
                        CANCEL
                      </button>

                      <button
                        type="button"
                        onClick={() => void addToWishlist()}
                        disabled={
                          saving || loadingFolders
                        }
                        className="flex-1 bg-bone px-4 py-4 text-[10px] font-medium tracking-[0.16em] text-void transition-colors hover:bg-mango disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {saving
                          ? "SAVING…"
                          : "ADD TO WISHLIST"}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        type="button"
        onClick={openWishlistModal}
        aria-pressed={saved}
        aria-label={
          saved
            ? `Saved ${productName} to wishlist`
            : `Save ${productName} to wishlist`
        }
        title={
          saved
            ? "Saved to wishlist"
            : "Save to wishlist"
        }
        className={`inline-flex items-center justify-center gap-2 transition-colors ${
          saved
            ? "text-mango"
            : "text-bone-dim hover:text-bone"
        } ${className}`}
      >
        <svg
          viewBox="0 0 24 24"
          className={icon}
          aria-hidden="true"
          fill={saved ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.6"
        >
          <path
            strokeLinejoin="round"
            d="M12 20.5s-7.5-4.6-9.2-9.3C1.6 7.9 3.6 4.5 7 4.5c2 0 3.6 1.1 5 2.9 1.4-1.8 3-2.9 5-2.9 3.4 0 5.4 3.4 4.2 6.7-1.7 4.7-9.2 9.3-9.2 9.3Z"
          />
        </svg>

        {withLabel && (
          <span className="text-[10px] font-medium uppercase tracking-[0.18em]">
            {saved ? "Saved" : "Wishlist"}
          </span>
        )}
      </button>

      {/* 
        IMPORTANT:
        The modal is rendered into document.body using a portal.
        Therefore it is centered relative to the browser viewport,
        not relative to the product/card/container.
      */}
      {modal}
    </>
  );
}
