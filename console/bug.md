## Error Type
Console Error

## Error Message
In HTML, <button> cannot be a descendant of <button>.
This will cause a hydration error.

  ...
    <HTTPAccessFallbackBoundary notFound={undefined} forbidden={undefined} unauthorized={undefined}>
      <RedirectBoundary>
        <RedirectErrorBoundary router={{...}}>
          <InnerLayoutRouter url="/vault" tree={[...]} params={{}} cacheNode={{rsc:<Fragment>, ...}} segmentPath={[...]} ...>
            <SegmentViewNode type="page" pagePath="/vault/app...">
              <SegmentTrieNode>
              <ClientPageRoot Component={function VaultPage} serverProvidedParams={{...}}>
                <VaultPage params={Promise} searchParams={Promise}>
                  <div className="min-h-scre...">
                    <header>
                    <main className="container-...">
                      <div className="space-y-6 ...">
                        <div>
                        <div>
                        <VaultList credentials={[...]} onSelectCredential={function handleSelectCredential}>
                          <div className="divide-y d...">
                            <VaultItem id="fffc9226-8..." title="Gmail" username="chevianbs@..." ...>
>                             <button
>                               onClick={function onClick}
>                               className="w-full group flex items-center gap-4 py-4 px-2 -mx-2 hover:bg-muted/30 roun..."
>                               style={{animation:"fadeIn 0.3..."}}
>                             >
                                <div>
                                <div className="flex-1 min...">
                                  <div>
                                  <div className="flex items...">
                                    <span>
>                                   <button
>                                     onClick={function handleCopyUsername}
>                                     className="opacity-0 group-hover:opacity-100 transition-opacity p-1 -m-1 hover:b..."
>                                   >
                                ...
                    ...
            ...
          ...



    at button (<anonymous>:null:null)
    at VaultItem (components/vault/vault-item.tsx:82:13)
    at <unknown> (components/vault/vault-list.tsx:43:9)
    at Array.map (<anonymous>:null:null)
    at VaultList (components/vault/vault-list.tsx:42:20)
    at VaultPage (app/vault/page.tsx:216:11)

## Code Frame
  80 |               {username}
  81 |             </span>
> 82 |             <button
     |             ^
  83 |               onClick={handleCopyUsername}
  84 |               className="opacity-0 group-hover:opacity-100 transition-opacity p-1 -m-1 hover:bg-muted rounded-md"
  85 |             >

Next.js version: 16.1.7 (Turbopack)
